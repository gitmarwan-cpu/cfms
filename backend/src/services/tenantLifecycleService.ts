import { Prisma, enum_organizations_lifecycle_status } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { getEffectivePlatformPermissions } from './rbacService';
import { recordAuditEvent } from './auditService';

export type OrganizationId = string | number;
export type LifecycleStatus = enum_organizations_lifecycle_status;

const LIFECYCLE_PERMISSION = 'platform.tenant.lifecycle';

type DbClient = typeof prisma | Prisma.TransactionClient;

export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<LifecycleStatus, readonly LifecycleStatus[]> = {
  provisioning: ['active'],
  active: ['suspended', 'deactivated'],
  suspended: ['active'],
  deactivated: ['archived'],
  archived: [],
};

export const assertActiveTenant = async (organizationId: OrganizationId, client: DbClient = prisma) => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) throw new ApiError(422, 'المؤسسة غير موجودة');

  const organization = await client.organizations.findFirst({
    where: { id: parsedOrganizationId, parent_id: null },
    select: { id: true, lifecycle_status: true, is_active: true, deleted_at: true },
  });
  if (!organization) throw new ApiError(404, 'المؤسسة غير موجودة');
  if (!organization.is_active || organization.deleted_at !== null || organization.lifecycle_status !== 'active') {
    throw new ApiError(403, 'لا يمكن إدارة عضويات أو أدوار مؤسسة غير مفعّلة');
  }

  return organization;
};

const toSafeInteger = (value: OrganizationId | number): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeReason = (reason?: string | null): string | null => {
  if (reason === undefined || reason === null) return null;
  const normalized = reason.trim();
  if (normalized.length > 255) throw new ApiError(422, 'سبب تغيير حالة المؤسسة يتجاوز 255 حرفاً');
  return normalized || null;
};

const assertPlatformLifecycleAuthority = async (actorUserId: number): Promise<void> => {
  const actor = await prisma.users.findUnique({ where: { id: actorUserId }, select: { id: true, is_active: true } });
  if (!actor || !actor.is_active) throw new ApiError(403, 'لا يملك المستخدم صلاحية إدارة دورة حياة المنصة');

  const permissions = await getEffectivePlatformPermissions(actorUserId);
  if (!permissions.some(({ code }) => code === LIFECYCLE_PERMISSION)) {
    throw new ApiError(403, 'لا يملك المستخدم صلاحية إدارة دورة حياة المؤسسة');
  }
};

export const transitionTenantLifecycle = async (
  organizationId: OrganizationId,
  nextStatus: LifecycleStatus,
  actorUserId: number,
  reason?: string | null,
  client?: DbClient
) => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedActorUserId = toSafeInteger(actorUserId);
  if (parsedOrganizationId === null) throw new ApiError(422, 'المؤسسة غير موجودة');
  if (parsedActorUserId === null) throw new ApiError(403, 'مستخدم التغيير غير صالح');

  const allowedStatuses = Object.keys(ALLOWED_LIFECYCLE_TRANSITIONS) as LifecycleStatus[];
  if (!allowedStatuses.includes(nextStatus)) throw new ApiError(422, 'حالة دورة الحياة غير صالحة');
  const normalizedReason = normalizeReason(reason);

  await assertPlatformLifecycleAuthority(parsedActorUserId);

  const applyTransition = async (tx: DbClient) => {
    const organization = await tx.organizations.findFirst({
      where: {
        id: parsedOrganizationId,
        parent_id: null,
        root_organization_id: null,
        org_unit_type_id: null,
      },
      select: { id: true, lifecycle_status: true },
    });
    if (!organization) throw new ApiError(404, 'المؤسسة غير موجودة');

    const allowedNextStatuses = ALLOWED_LIFECYCLE_TRANSITIONS[organization.lifecycle_status];
    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new ApiError(409, `لا يمكن الانتقال من حالة ${organization.lifecycle_status} إلى ${nextStatus}`);
    }

    const changedAt = new Date();
    const updated = await tx.organizations.update({
      where: { id: organization.id },
      data: {
        lifecycle_status: nextStatus,
        status_changed_at: changedAt,
        status_changed_by_user_id: parsedActorUserId,
        status_reason: normalizedReason,
        write_date: changedAt,
        write_uid: parsedActorUserId,
      },
      select: {
        id: true,
        lifecycle_status: true,
        status_changed_at: true,
        status_changed_by_user_id: true,
        status_reason: true,
      },
    });

    await recordAuditEvent(tx, {
      organizationId: organization.id,
      actorUserId: parsedActorUserId,
      action: 'organization.lifecycle.changed',
      entityType: 'organization',
      entityId: organization.id,
      metadata: {
        previousStatus: organization.lifecycle_status,
        nextStatus,
        reason: normalizedReason,
      },
    });

    return updated;
  };

  return client ? applyTransition(client) : prisma.$transaction(applyTransition);
};
