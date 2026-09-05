import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';
import { countActiveAdmins } from './membershipService';

export type OrganizationId = string | number;
export type UserId = string | number;
export type RoleId = string | number;
export type UserRoleId = string | number;

const toSafeInteger = (value: string | number): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const optionalId = (value: string | number | null | undefined): number | null => {
  if (value === undefined || value === null || value === '') return null;
  return toSafeInteger(value);
};

const USER_ROLE_SELECT = {
  id: true,
  user_id: true,
  role_id: true,
  organization_id: true,
  organization_node_id: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  roles: { select: { id: true, code: true, name_ar: true, name_en: true } },
  organization_node: { select: { id: true, legal_name: true, short_name: true, code: true } },
} as const;

const mapUserRole = (entry: any) => ({
  id: entry.id,
  userId: entry.user_id,
  roleId: entry.role_id,
  organizationId: entry.organization_id,
  organizationNodeId: entry.organization_node_id,
  createDate: entry.create_date,
  writeDate: entry.write_date,
  createUid: entry.create_uid,
  writeUid: entry.write_uid,
  createdAt: entry.create_date,
  updatedAt: entry.write_date,
  role: {
    id: entry.roles.id,
    code: entry.roles.code,
    nameAr: entry.roles.name_ar,
    nameEn: entry.roles.name_en,
  },
  organizationNode: entry.organization_node
    ? {
        id: entry.organization_node.id,
        legalName: entry.organization_node.legal_name,
        shortName: entry.organization_node.short_name,
        code: entry.organization_node.code,
      }
    : null,
});

export const listUserRoles = async (organizationId: OrganizationId, userId: UserId) => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserId = toSafeInteger(userId);
  const membership = parsedOrganizationId && parsedUserId
    ? await prisma.user_organizations.findFirst({ where: { user_id: parsedUserId, organization_id: parsedOrganizationId } })
    : null;
  if (!membership) throw new ApiError(404, 'المستخدم غير موجود ضمن مؤسستك');

  const entries = await prisma.user_roles.findMany({
    where: { user_id: parsedUserId as number, organization_id: parsedOrganizationId as number },
    select: USER_ROLE_SELECT,
  });
  return entries.map(mapUserRole);
};

export const assignRole = async (
  organizationId: OrganizationId,
  payload: { userId: UserId; roleId: RoleId; organizationNodeId?: string | number | null },
  authUserId?: number | null
) => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserId = toSafeInteger(payload.userId);
  const parsedRoleId = toSafeInteger(payload.roleId);
  const parsedOrganizationNodeId = optionalId(payload.organizationNodeId);
  const [user, role] = parsedUserId && parsedRoleId
    ? await Promise.all([
        prisma.users.findUnique({ where: { id: parsedUserId }, select: { id: true } }),
        prisma.roles.findFirst({
          where: { id: parsedRoleId, OR: [{ organization_id: null }, { organization_id: parsedOrganizationId as number }] },
          select: { id: true, code: true, is_active: true },
        }),
      ])
    : [null, null];
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  if (!role || !role.is_active) throw new ApiError(404, 'الدور غير موجود أو غير مفعّل ضمن مؤسستك');

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: parsedUserId as number, organization_id: parsedOrganizationId as number, is_active: true },
  });
  if (!membership) throw new ApiError(400, 'لا يمكن إسناد دور لمستخدم غير عضو في هذه المؤسسة؛ أضفه كعضو أولاً');

  if (payload.organizationNodeId) {
    const node = await prisma.organizations.findFirst({
      where: {
        id: parsedOrganizationNodeId as number,
        is_active: true,
        deleted_at: null,
        OR: [{ id: parsedOrganizationId as number }, { root_organization_id: parsedOrganizationId as number }],
      },
      select: { id: true },
    });
    if (!node) throw new ApiError(404, 'الوحدة التنظيمية غير موجودة أو غير مفعّلة ضمن مؤسستك');
  }

  const existing = await prisma.user_roles.findFirst({
    where: {
      user_id: parsedUserId as number,
      role_id: parsedRoleId as number,
      organization_id: parsedOrganizationId as number,
      organization_node_id: parsedOrganizationNodeId,
    },
  });
  if (existing) throw new ApiError(409, 'هذا التعيين موجود بالفعل');

  const now = new Date();
  // Create + audit must succeed or fail together (Phase 3 atomicity contract).
  const created = await prisma.$transaction(async (tx) => {
    const createdRow = await tx.user_roles.create({
      data: {
        user_id: parsedUserId as number,
        role_id: parsedRoleId as number,
        organization_id: parsedOrganizationId as number,
        organization_node_id: parsedOrganizationNodeId,
        create_date: now,
        write_date: now,
        create_uid: authUserId || null,
        write_uid: authUserId || null,
      },
      select: USER_ROLE_SELECT,
    });

    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId as number,
      actorUserId: authUserId ?? null,
      action: 'user_role.assigned',
      entityType: 'user_role',
      entityId: createdRow.id,
      metadata: {
        userId: parsedUserId as number,
        roleId: parsedRoleId as number,
        roleCode: role.code,
        organizationNodeId: parsedOrganizationNodeId,
      },
    });

    return createdRow;
  });
  return mapUserRole(created);
};

export const revokeRole = async (
  organizationId: OrganizationId,
  userRoleId: UserRoleId,
  actorUserId?: number | null
): Promise<void> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserRoleId = toSafeInteger(userRoleId);

  // Lookup, last-admin guard, delete and audit must all execute inside the
  // same transaction (Phase 3 atomicity contract): the role code and target
  // user_id used for the audit metadata are fetched INSIDE the transaction,
  // immediately before the delete.
  await prisma.$transaction(async (tx) => {
    const userRole = parsedOrganizationId && parsedUserRoleId
      ? await tx.user_roles.findFirst({
          where: { id: parsedUserRoleId, organization_id: parsedOrganizationId },
          select: { id: true, role_id: true, user_id: true },
        })
      : null;
    if (!userRole) throw new ApiError(404, 'تعيين الدور غير موجود ضمن مؤسستك');

    const role = await tx.roles.findUnique({ where: { id: userRole.role_id }, select: { code: true } });
    if (role?.code === 'admin') {
      // Canonical active-admin count (single authoritative implementation in
      // membershipService.countActiveAdmins): an admin only keeps the tenant
      // administrable while their USER record is active AND their membership
      // in this organization is active (Fix 1.4). Counting raw user_roles rows
      // would let a stale admin row (active user, removed membership) mask the
      // removal of the last functioning admin and lock the tenant out.
      const remainingActiveAdmins = await countActiveAdmins(tx, parsedOrganizationId as number);
      if (remainingActiveAdmins <= 1) throw new ApiError(400, 'لا يمكن إلغاء آخر مدير في هذه المؤسسة');
    }

    await tx.user_roles.delete({ where: { id: userRole.id } });

    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId as number,
      actorUserId: actorUserId ?? null,
      action: 'user_role.revoked',
      entityType: 'user_role',
      entityId: userRole.id,
      metadata: {
        userId: userRole.user_id,
        roleId: userRole.role_id,
        roleCode: role?.code ?? null,
      },
    });
  });
};
