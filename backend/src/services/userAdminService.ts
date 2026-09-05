import type { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';
import { countActiveAdmins } from './membershipService';

/**
 * Backend User Administration service.
 *
 * Tenant scope always comes from `organizationId` resolved by
 * `resolveAuthenticatedTenant` — never from request body/query.
 *
 * Canonical hierarchy: `users.primary_organization_node_id` references the
 * unified `organizations` hierarchy. Legacy `org_units` are NOT used by any
 * new user-management functionality.
 *
 * Tenant membership is established through `user_organizations` — the
 * authoritative many-to-many join between users and organizations.
 * A user is "in" an organization iff a `user_organizations` row exists
 * linking that user to that organization.
 */

export interface UserListFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  isActive?: string;
}

export interface UserUpdatePayload {
  fullName?: string;
  email?: string;
  primaryOrganizationNodeId?: number | string | null;
}

const USER_NOT_FOUND = 'المستخدم غير موجود ضمن مؤسستك';

const USER_SAFE_SELECT = {
  id: true,
  full_name: true,
  email: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  default_organization_id: true,
  primary_organization_node_id: true,
  primary_organization_node: {
    select: {
      id: true,
      legal_name: true,
      short_name: true,
      code: true,
      parent_id: true,
      root_organization_id: true,
      org_unit_type_id: true,
      is_active: true,
    },
  },
} as const;

type SelectedUser = Prisma.usersGetPayload<{ select: typeof USER_SAFE_SELECT }>;

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const mapUser = (user: SelectedUser) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  isActive: user.is_active,
  createDate: user.create_date,
  writeDate: user.write_date,
  createUid: user.create_uid,
  writeUid: user.write_uid,
  createdAt: user.create_date,
  updatedAt: user.write_date,
  defaultOrganizationId: user.default_organization_id,
  primaryOrganizationNodeId: user.primary_organization_node_id,
  primaryOrganizationNode: user.primary_organization_node
    ? {
        id: user.primary_organization_node.id,
        legalName: user.primary_organization_node.legal_name,
        shortName: user.primary_organization_node.short_name,
        code: user.primary_organization_node.code,
        isActive: user.primary_organization_node.is_active,
      }
    : null,
});

/**
 * Returns the membership row for a user in the given organization,
 * or null if the user is not a member.
 *
 * Uses `user_organizations` — the authoritative tenant membership table.
 */
const getMembership = (parsedOrganizationId: number, parsedUserId: number) =>
  prisma.user_organizations.findFirst({
    where: { user_id: parsedUserId, organization_id: parsedOrganizationId },
    select: { user_id: true },
  });

// ─── List Users ────────────────────────────────────────────────────────────────

export const listUsers = async (organizationId: number, filters: UserListFilters = {}) => {
  const page = Math.max(1, Number.parseInt(String(filters.page || ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit || ''), 10) || 20));

  const where: Prisma.usersWhereInput = {
    // Only users with an ACTIVE membership row in this organization are
    // tenant members; soft-revoked memberships must hide the user here
    // (mirrors getMyOrganizations in authService.ts).
    user_organizations: { some: { organization_id: organizationId, is_active: true } },
  };

  // Active/inactive filter
  if (filters.isActive === 'true') {
    where.is_active = true;
  } else if (filters.isActive === 'false') {
    where.is_active = false;
  }

  // Search by full_name or email (case-insensitive)
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { full_name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.users.findMany({
      where,
      select: USER_SAFE_SELECT,
      orderBy: { create_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.users.count({ where }),
  ]);

  return {
    data: rows.map(mapUser),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Get User By ID ────────────────────────────────────────────────────────────

export const getUserById = async (organizationId: number, userId: unknown) => {
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  const membership = await getMembership(organizationId, parsedUserId);
  if (!membership) throw new ApiError(404, USER_NOT_FOUND);

  const user = await prisma.users.findUnique({
    where: { id: parsedUserId },
    select: USER_SAFE_SELECT,
  });
  if (!user) throw new ApiError(404, USER_NOT_FOUND);

  return mapUser(user);
};

// ─── Update User ───────────────────────────────────────────────────────────────

export const updateUser = async (
  organizationId: number,
  userId: unknown,
  payload: UserUpdatePayload,
  actorUserId?: number | null
) => {
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  const membership = await getMembership(organizationId, parsedUserId);
  if (!membership) throw new ApiError(404, USER_NOT_FOUND);

  const data: Prisma.usersUpdateInput = { write_date: new Date() };

  if (payload.fullName !== undefined) {
    const trimmed = payload.fullName.trim();
    if (trimmed.length < 2 || trimmed.length > 150) {
      throw new ApiError(400, 'الاسم الكامل يجب أن يكون بين 2 و 150 حرفاً');
    }
    data.full_name = trimmed;
  }

  if (payload.email !== undefined) {
    const trimmedEmail = payload.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new ApiError(400, 'البريد الإلكتروني غير صالح');
    }
    // Check for email uniqueness (excluding current user)
    const existing = await prisma.users.findFirst({
      where: { email: trimmedEmail, id: { not: parsedUserId } },
      select: { id: true },
    });
    if (existing) throw new ApiError(409, 'البريد الإلكتروني مستخدم بالفعل');
    data.email = trimmedEmail;
  }

  if (payload.primaryOrganizationNodeId !== undefined) {
    if (payload.primaryOrganizationNodeId === null || payload.primaryOrganizationNodeId === '') {
      // Clear the assignment
      data.primary_organization_node = { disconnect: true };
    } else {
      const parsedNodeId = toPositiveInteger(payload.primaryOrganizationNodeId);
      if (!parsedNodeId) throw new ApiError(400, 'معرّف العقدة التنظيمية غير صالح');

      // Validate that the node belongs to the authenticated tenant (root_organization_id check)
      const node = await prisma.organizations.findFirst({
        where: {
          id: parsedNodeId,
          is_active: true,
          deleted_at: null,
          OR: [
            { id: organizationId },
            { root_organization_id: organizationId },
            { parent_id: organizationId },
          ],
        },
        select: { id: true },
      });
      if (!node) throw new ApiError(404, 'العقدة التنظيمية غير موجودة ضمن مؤسستك أو غير مفعّلة');
      data.primary_organization_node = { connect: { id: parsedNodeId } };
    }
  }

  const updated = await prisma.users.update({
    where: { id: parsedUserId },
    data,
    select: USER_SAFE_SELECT,
  });

  await recordAuditEvent(prisma, {
    organizationId,
    actorUserId: actorUserId ?? null,
    action: 'user.updated',
    entityType: 'user',
    entityId: parsedUserId,
    metadata: { fields: Object.keys(payload) },
  });

  return mapUser(updated);
};

// ─── Deactivate User ───────────────────────────────────────────────────────────

/**
 * Deactivates a user (soft disable). Refuses to deactivate the last admin of
 * an organization to prevent lockout — mirrors the last-admin protection in
 * `userRoleService.revokeRole`.
 */
export const deactivateUser = async (
  organizationId: number,
  userId: unknown,
  actorUserId?: number | null
) => {
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  const membership = await getMembership(organizationId, parsedUserId);
  if (!membership) throw new ApiError(404, USER_NOT_FOUND);

  // Prevent self-deactivation locking out the session (optional guard)
  if (actorUserId && parsedUserId === actorUserId) {
    throw new ApiError(400, 'لا يمكنك إلغاء تفعيل حسابك بنفسك');
  }

  const user = await prisma.users.findUnique({
    where: { id: parsedUserId },
    select: { id: true, is_active: true },
  });
  if (!user) throw new ApiError(404, USER_NOT_FOUND);
  if (!user.is_active) throw new ApiError(400, 'المستخدم غير مفعّل أصلاً');

  // Last-admin protection: check if this user is the only active admin in the org
  const adminRole = await prisma.roles.findFirst({
    where: { code: 'admin', OR: [{ organization_id: null }, { organization_id: organizationId }] },
    select: { id: true },
  });
  const isTargetAdmin = adminRole
    ? await prisma.user_roles.findFirst({
        where: { user_id: parsedUserId, role_id: adminRole.id, organization_id: organizationId },
        select: { id: true },
      })
    : null;

  // Deactivation + audit must succeed or fail together (Phase 3 atomicity
  // contract): a deactivated user without its audit row is a partial state.
  const updated = await prisma.$transaction(async (tx) => {
    // Last-admin protection: evaluated INSIDE the transaction so a concurrent
    // admin-membership removal cannot slip between the check and the update
    // and leave the tenant with zero active admins.
    if (adminRole && isTargetAdmin) {
      // Canonical active-admin count (single authoritative implementation in
      // membershipService.countActiveAdmins): an admin only counts while their
      // user record AND their membership in this organization are active
      // (Fix 1.5) — a stale admin row (active user, removed membership) must
      // never mask the deactivation of the last functioning admin.
      const activeAdminCount = await countActiveAdmins(tx, organizationId);
      if (activeAdminCount <= 1) {
        throw new ApiError(400, 'لا يمكن إلغاء تفعيل آخر مدير نشط في هذه المؤسسة');
      }
    }

    const deactivated = await tx.users.update({
      where: { id: parsedUserId },
      data: { is_active: false, write_date: new Date() },
      select: USER_SAFE_SELECT,
    });

    await recordAuditEvent(tx, {
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'user.deactivated',
      entityType: 'user',
      entityId: parsedUserId,
    });

    return deactivated;
  });

  return mapUser(updated);
};

// ─── Activate User ─────────────────────────────────────────────────────────────

export const activateUser = async (
  organizationId: number,
  userId: unknown,
  actorUserId?: number | null
) => {
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  const membership = await getMembership(organizationId, parsedUserId);
  if (!membership) throw new ApiError(404, USER_NOT_FOUND);

  const user = await prisma.users.findUnique({
    where: { id: parsedUserId },
    select: { id: true, is_active: true },
  });
  if (!user) throw new ApiError(404, USER_NOT_FOUND);
  if (user.is_active) throw new ApiError(400, 'المستخدم مفعّل بالفعل');

  const updated = await prisma.$transaction(async (tx) => {
    const activated = await tx.users.update({
      where: { id: parsedUserId },
      data: { is_active: true, write_date: new Date() },
      select: USER_SAFE_SELECT,
    });

    await recordAuditEvent(tx, {
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'user.activated',
      entityType: 'user',
      entityId: parsedUserId,
    });

    return activated;
  });

  return mapUser(updated);
};