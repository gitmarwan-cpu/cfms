import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';
import { createNotification } from './notificationService';

/**
 * Membership lifecycle management (Phase 3).
 *
 * Single authoritative implementation of the tenant-membership invariants:
 *
 *  - Last-membership invariant: a user can never be left with zero ACTIVE
 *    `user_organizations` rows through these endpoints.
 *  - Last-active-admin invariant: a removal must not leave the organization
 *    with zero users who simultaneously (a) hold the `admin` role in the org,
 *    (b) have `is_active: true` on their user record, and (c) have
 *    `is_active: true` on their membership row in that org.
 *  - Soft-delete only: "removal" sets `user_organizations.is_active = false`;
 *    rows are never hard-deleted so audit history is preserved.
 *  - Reactivation: `@@unique([user_id, organization_id])` means at most one
 *    row can exist per (user, org) pair — an inactive row is reactivated in
 *    place, never recreated.
 *  - Primary/default sync: setting a membership primary unsets primary on the
 *    user's OTHER organizations and syncs `users.default_organization_id`,
 *    atomically in one transaction.
 *
 * Every mutation writes its audit event inside the same Prisma transaction
 * (recordAuditEvent receives the transaction client), so a mutation can never
 * succeed without its audit record. Notifications are sent AFTER the
 * transaction commits.
 */

const USER_NOT_FOUND = 'المستخدم غير موجود';
const MEMBERSHIP_NOT_FOUND = 'العضوية غير موجودة ضمن مؤسستك';

const toPositiveInteger = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const MEMBERSHIP_SELECT = {
  id: true,
  user_id: true,
  organization_id: true,
  is_primary: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  organizations: { select: { id: true, legal_name: true, short_name: true } },
} as const;

const mapMembership = (membership: any) => ({
  id: membership.id,
  userId: membership.user_id,
  organizationId: membership.organization_id,
  isPrimary: membership.is_primary,
  isActive: membership.is_active,
  createdAt: membership.create_date,
  updatedAt: membership.write_date,
  organization: membership.organizations
    ? {
        id: membership.organizations.id,
        legalName: membership.organizations.legal_name,
        shortName: membership.organizations.short_name,
      }
    : null,
});

/** Minimal type accepted anywhere Prisma accepts a client/transaction client. */
type DbClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Counts the organization's active admins: users holding the `admin` role in
 * this org whose user record is active AND whose membership row in this org is
 * active. Mirrors the corrected counting logic in userRoleService.revokeRole
 * (Fix 1.1) — inactive users or inactive memberships never keep a tenant
 * administrable.
 */
const countActiveAdmins = async (tx: DbClient, organizationId: number): Promise<number> => {
  const adminRoleHolders = await tx.user_roles.findMany({
    where: { organization_id: organizationId, roles: { code: 'admin' } },
    select: { user_id: true },
  });
  const adminUserIds = Array.from(new Set(adminRoleHolders.map((holder) => holder.user_id)));
  if (adminUserIds.length === 0) return 0;

  return tx.user_organizations.count({
    where: {
      organization_id: organizationId,
      is_active: true,
      user_id: { in: adminUserIds },
      users: { is_active: true },
    },
  });
};

/** Syncs `users.default_organization_id` to the given organization. */
const syncDefaultOrganization = async (
  tx: DbClient,
  userId: number,
  organizationId: number
): Promise<void> => {
  await tx.users.update({
    where: { id: userId },
    data: { default_organization_id: organizationId, write_date: new Date() },
  });
};

// ─── List Memberships ─────────────────────────────────────────────────────────

/**
 * Returns the memberships of a user scoped to the given organization
 * (≤ 1 row today due to the @@unique constraint, but returned as an array
 * for forward compatibility).
 */
export const listMemberships = async (organizationId: unknown, userId: unknown) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedOrganizationId) throw new ApiError(400, 'المؤسسة غير موجودة');
  if (!parsedUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  const rows = await prisma.user_organizations.findMany({
    where: { user_id: parsedUserId, organization_id: parsedOrganizationId },
    select: MEMBERSHIP_SELECT,
    orderBy: { id: 'asc' },
  });
  return rows.map(mapMembership);
};

// ─── Add Membership ───────────────────────────────────────────────────────────

/**
 * Adds a user to the authenticated organization (or reactivates their
 * existing inactive membership in place).
 *
 * The target organization is ALWAYS the caller's tenant context — it is never
 * accepted from the request body, which keeps this endpoint free of any
 * cross-tenant membership-grant path.
 */
export const addMembership = async (
  organizationId: unknown,
  actorUserId: number | null | undefined,
  targetUserId: unknown
) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  if (!parsedOrganizationId) throw new ApiError(400, 'المؤسسة غير موجودة');
  const parsedTargetUserId = toPositiveInteger(targetUserId);
  if (!parsedTargetUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  const target = await prisma.users.findUnique({
    where: { id: parsedTargetUserId },
    select: { id: true, full_name: true },
  });
  if (!target) throw new ApiError(404, USER_NOT_FOUND);

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // @@unique([user_id, organization_id]) means at most one row can ever
    // exist for this (user, org) pair — check BEFORE attempting a create.
    const existing = await tx.user_organizations.findFirst({
      where: { user_id: parsedTargetUserId, organization_id: parsedOrganizationId },
      select: { id: true, is_active: true, is_primary: true },
    });

    if (existing && existing.is_active) {
      throw new ApiError(409, 'المستخدم عضو نشط في هذه المؤسسة بالفعل');
    }

    if (existing) {
      // Reactivation in place: the existing row (and its audit history) is
      // preserved; no new row is ever created over an inactive one.
      const otherActiveCount = await tx.user_organizations.count({
        where: {
          user_id: parsedTargetUserId,
          organization_id: { not: parsedOrganizationId },
          is_active: true,
        },
      });
      // First-active-membership rule: primary state may only change here when
      // the user has zero other active memberships.
      const shouldBecomePrimary = otherActiveCount === 0;

      const updated = await tx.user_organizations.update({
        where: { id: existing.id },
        data: {
          is_active: true,
          is_primary: shouldBecomePrimary ? true : existing.is_primary,
          write_date: now,
          write_uid: actorUserId ?? null,
        },
        select: MEMBERSHIP_SELECT,
      });

      await recordAuditEvent(tx, {
        organizationId: parsedOrganizationId,
        actorUserId: actorUserId ?? null,
        action: 'membership.granted',
        entityType: 'user_organization',
        entityId: updated.id,
        metadata: {
          userId: parsedTargetUserId,
          reactivated: true,
          isPrimary: updated.is_primary,
        },
      });

      if (shouldBecomePrimary) {
        await syncDefaultOrganization(tx, parsedTargetUserId, parsedOrganizationId);
      }

      return { membership: mapMembership(updated), reactivated: true };
    }

    // Fresh grant: primary only if this is the user's first active membership.
    const firstActiveCount = await tx.user_organizations.count({
      where: { user_id: parsedTargetUserId, is_active: true },
    });
    const isPrimary = firstActiveCount === 0;

    const created = await tx.user_organizations.create({
      data: {
        user_id: parsedTargetUserId,
        organization_id: parsedOrganizationId,
        is_primary: isPrimary,
        is_active: true,
        create_date: now,
        write_date: now,
        create_uid: actorUserId ?? null,
        write_uid: actorUserId ?? null,
      },
      select: MEMBERSHIP_SELECT,
    });

    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: actorUserId ?? null,
      action: 'membership.granted',
      entityType: 'user_organization',
      entityId: created.id,
      metadata: {
        userId: parsedTargetUserId,
        reactivated: false,
        isPrimary: created.is_primary,
      },
    });

    if (isPrimary) {
      await syncDefaultOrganization(tx, parsedTargetUserId, parsedOrganizationId);
    }

    return { membership: mapMembership(created), reactivated: false };
  });

  // Notification AFTER commit — never inside the transaction.
  try {
    const org = await prisma.organizations.findUnique({
      where: { id: parsedOrganizationId },
      select: { legal_name: true },
    });
    await createNotification(prisma, {
      organizationId: parsedOrganizationId,
      userId: parsedTargetUserId,
      notificationType: 'membership.granted',
      title: 'إضافة عضوية',
      message: result.reactivated
        ? `تمت إعادة تفعيل عضويتك في «${org?.legal_name ?? ''}»`
        : `تمت إضافتك كعضو في «${org?.legal_name ?? ''}»`,
      entityType: 'user_organization',
      entityId: result.membership.id,
      metadata: { reactivated: result.reactivated },
    });
  } catch (error) {
    console.error('[membershipService] Failed to send membership.granted notification:', error);
  }

  return result.membership;
};

// ─── Remove Membership (soft delete) ─────────────────────────────────────────

/**
 * Soft-revokes a membership (`is_active = false`; the row is never deleted).
 * Enforces the last-membership, last-active-admin and self-removal invariants.
 */
export const removeMembership = async (
  organizationId: unknown,
  actorUserId: number | null | undefined,
  membershipId: unknown
) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  if (!parsedOrganizationId) throw new ApiError(400, 'المؤسسة غير موجودة');
  const parsedMembershipId = toPositiveInteger(membershipId);
  if (!parsedMembershipId) throw new ApiError(400, 'معرّف العضوية غير صالح');

  const now = new Date();

  const removed = await prisma.$transaction(async (tx) => {
    const membership = await tx.user_organizations.findFirst({
      where: { id: parsedMembershipId },
      select: { id: true, user_id: true, organization_id: true, is_active: true, is_primary: true },
    });
    // 404 (not 403) for a missing row AND for a row belonging to another
    // tenant — the existence of cross-tenant resources must never be leaked.
    if (!membership || membership.organization_id !== parsedOrganizationId) {
      throw new ApiError(404, MEMBERSHIP_NOT_FOUND);
    }
    if (!membership.is_active) {
      throw new ApiError(400, 'العضوية غير مفعّلة بالفعل');
    }

    const targetUserId = membership.user_id;

    // Last-membership invariant: at least one ACTIVE membership must remain.
    const otherActiveCount = await tx.user_organizations.count({
      where: {
        user_id: targetUserId,
        is_active: true,
        id: { not: membership.id },
      },
    });
    if (otherActiveCount === 0) {
      throw new ApiError(400, 'لا يمكن إزالة آخر عضوية نشطة للمستخدم');
    }

    // Last-active-admin invariant: does the target hold the admin role here?
    // Only a target who is THEMSELVES an active admin (admin role + active
    // user record + this active membership) can reduce the organization's
    // active-admin count — removing an inactive admin's membership cannot.
    const holdsAdminRole = await tx.user_roles.findFirst({
      where: { user_id: targetUserId, organization_id: parsedOrganizationId, roles: { code: 'admin' } },
      select: { id: true },
    });
    if (holdsAdminRole) {
      const targetUser = await tx.users.findUnique({
        where: { id: targetUserId },
        select: { is_active: true },
      });
      if (targetUser?.is_active) {
        const activeAdminCount = await countActiveAdmins(tx, parsedOrganizationId);
        if (activeAdminCount <= 1) {
          // Self-removal is covered by the same invariant: removing your own
          // membership must never leave the org with zero active admins either.
          throw new ApiError(400, 'لا يمكن إزالة العضوية لأنها ستترك المؤسسة بدون مدير نشط');
        }
      }
    }

    const updated = await tx.user_organizations.update({
      where: { id: membership.id },
      data: { is_active: false, write_date: now, write_uid: actorUserId ?? null },
      select: MEMBERSHIP_SELECT,
    });

    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: actorUserId ?? null,
      action: 'membership.revoked',
      entityType: 'user_organization',
      entityId: updated.id,
      metadata: {
        userId: targetUserId,
        wasPrimary: membership.is_primary,
      },
    });

    return { membership: mapMembership(updated), targetUserId };
  });

  // Notification AFTER commit — never inside the transaction.
  try {
    const org = await prisma.organizations.findUnique({
      where: { id: parsedOrganizationId },
      select: { legal_name: true },
    });
    await createNotification(prisma, {
      organizationId: parsedOrganizationId,
      userId: removed.targetUserId,
      notificationType: 'membership.revoked',
      title: 'إلغاء عضوية',
      message: `تم إلغاء عضويتك في «${org?.legal_name ?? ''}»`,
      entityType: 'user_organization',
      entityId: removed.membership.id,
      metadata: { removed: true },
    });
  } catch (error) {
    console.error('[membershipService] Failed to send membership.revoked notification:', error);
  }

  return removed.membership;
};

// ─── Set Primary Membership ───────────────────────────────────────────────────

/**
 * Marks a membership as the user's primary one: unsets `is_primary` on the
 * user's memberships in OTHER organizations and syncs
 * `users.default_organization_id` — atomically, in one transaction.
 */
export const setPrimaryMembership = async (
  organizationId: unknown,
  actorUserId: number | null | undefined,
  membershipId: unknown
) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  if (!parsedOrganizationId) throw new ApiError(400, 'المؤسسة غير موجودة');
  const parsedMembershipId = toPositiveInteger(membershipId);
  if (!parsedMembershipId) throw new ApiError(400, 'معرّف العضوية غير صالح');

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const membership = await tx.user_organizations.findFirst({
      where: { id: parsedMembershipId },
      select: { id: true, user_id: true, organization_id: true, is_active: true, is_primary: true },
    });
    if (!membership || membership.organization_id !== parsedOrganizationId) {
      throw new ApiError(404, MEMBERSHIP_NOT_FOUND);
    }
    if (!membership.is_active) {
      throw new ApiError(400, 'لا يمكن تعيين عضوية غير مفعّلة كعضوية أساسية');
    }

    const user = await tx.users.findUnique({
      where: { id: membership.user_id },
      select: { id: true, default_organization_id: true },
    });
    if (!user) throw new ApiError(404, USER_NOT_FOUND);

    const alreadyPrimary =
      membership.is_primary && user.default_organization_id === parsedOrganizationId;
    if (alreadyPrimary) {
      // Idempotent no-op: nothing changes, so nothing is audited.
      const current = await tx.user_organizations.findFirst({
        where: { id: membership.id },
        select: MEMBERSHIP_SELECT,
      });
      return mapMembership(current);
    }

    // Unset primary on the user's OTHER organizations. A user can hold at
    // most one membership row per organization (@@unique), so "other rows in
    // the same org" cannot exist — updateMany keeps that future-proof.
    await tx.user_organizations.updateMany({
      where: {
        user_id: membership.user_id,
        organization_id: { not: parsedOrganizationId },
        is_primary: true,
      },
      data: { is_primary: false, write_date: now },
    });

    const updated = await tx.user_organizations.update({
      where: { id: membership.id },
      data: { is_primary: true, write_date: now, write_uid: actorUserId ?? null },
      select: MEMBERSHIP_SELECT,
    });

    await syncDefaultOrganization(tx, membership.user_id, parsedOrganizationId);

    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: actorUserId ?? null,
      action: 'membership.primary_changed',
      entityType: 'user_organization',
      entityId: updated.id,
      metadata: {
        userId: membership.user_id,
        from: user.default_organization_id ?? null,
        to: parsedOrganizationId,
      },
    });

    return mapMembership(updated);
  });
};
