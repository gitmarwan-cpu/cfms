import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

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
  org_unit_id: true,
  created_at: true,
  updated_at: true,
  roles: { select: { id: true, code: true, name_ar: true, name_en: true } },
  org_units: { select: { id: true, name: true, code: true } },
} as const;

const mapUserRole = (entry: any) => ({
  id: entry.id,
  userId: entry.user_id,
  roleId: entry.role_id,
  organizationId: entry.organization_id,
  orgUnitId: entry.org_unit_id,
  createdAt: entry.created_at,
  updatedAt: entry.updated_at,
  role: {
    id: entry.roles.id,
    code: entry.roles.code,
    nameAr: entry.roles.name_ar,
    nameEn: entry.roles.name_en,
  },
  orgUnit: entry.org_units
    ? { id: entry.org_units.id, name: entry.org_units.name, code: entry.org_units.code }
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
  payload: { userId: UserId; roleId: RoleId; orgUnitId?: string | number | null }
) => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserId = toSafeInteger(payload.userId);
  const parsedRoleId = toSafeInteger(payload.roleId);
  const parsedOrgUnitId = optionalId(payload.orgUnitId);
  const [user, role] = parsedUserId && parsedRoleId
    ? await Promise.all([
        prisma.users.findUnique({ where: { id: parsedUserId }, select: { id: true } }),
        prisma.roles.findFirst({
          where: { id: parsedRoleId, OR: [{ organization_id: null }, { organization_id: parsedOrganizationId as number }] },
          select: { id: true, is_active: true },
        }),
      ])
    : [null, null];
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  if (!role || !role.is_active) throw new ApiError(404, 'الدور غير موجود أو غير مفعّل ضمن مؤسستك');

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: parsedUserId as number, organization_id: parsedOrganizationId as number, is_active: true },
  });
  if (!membership) throw new ApiError(400, 'لا يمكن إسناد دور لمستخدم غير عضو في هذه المؤسسة؛ أضفه كعضو أولاً');

  if (payload.orgUnitId) {
    const orgUnit = await prisma.org_units.findFirst({
      where: { id: parsedOrgUnitId as number, organization_id: parsedOrganizationId as number, deleted_at: null },
      select: { id: true },
    });
    if (!orgUnit) throw new ApiError(404, 'الوحدة التنظيمية غير موجودة ضمن مؤسستك');
  }

  const existing = await prisma.user_roles.findFirst({
    where: {
      user_id: parsedUserId as number,
      role_id: parsedRoleId as number,
      organization_id: parsedOrganizationId as number,
      org_unit_id: parsedOrgUnitId,
    },
  });
  if (existing) throw new ApiError(409, 'هذا التعيين موجود بالفعل');

  const created = await prisma.user_roles.create({
    data: {
      user_id: parsedUserId as number,
      role_id: parsedRoleId as number,
      organization_id: parsedOrganizationId as number,
      org_unit_id: parsedOrgUnitId,
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: USER_ROLE_SELECT,
  });
  return mapUserRole(created);
};

export const revokeRole = async (organizationId: OrganizationId, userRoleId: UserRoleId): Promise<void> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserRoleId = toSafeInteger(userRoleId);
  const userRole = parsedOrganizationId && parsedUserRoleId
    ? await prisma.user_roles.findFirst({
        where: { id: parsedUserRoleId, organization_id: parsedOrganizationId },
        select: { id: true, role_id: true },
      })
    : null;
  if (!userRole) throw new ApiError(404, 'تعيين الدور غير موجود ضمن مؤسستك');

  const role = await prisma.roles.findUnique({ where: { id: userRole.role_id }, select: { code: true } });
  if (role?.code === 'admin') {
    const remainingOrgAdmins = await prisma.user_roles.count({
      where: { role_id: userRole.role_id, organization_id: parsedOrganizationId as number, roles: { code: 'admin' } },
    });
    if (remainingOrgAdmins <= 1) throw new ApiError(400, 'لا يمكن إلغاء آخر مدير في هذه المؤسسة');
  }

  await prisma.user_roles.delete({ where: { id: parsedUserRoleId as number } });
};

