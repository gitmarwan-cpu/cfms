import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';
import { getEffectiveRoleCodes, getEffectivePermissions } from './rbacService';

export type OrganizationId = string | number;
export type UserId = string | number;

export interface UserListFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  isActive?: string | boolean;
}

const toPositiveInteger = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const USER_SELECT = {
  id: true,
  full_name: true,
  email: true,
  is_active: true,
  org_unit_id: true,
  default_organization_id: true,
  created_at: true,
  updated_at: true,
  org_units_users_org_unit_idToorg_units: {
    select: { id: true, name: true, code: true },
  },
  user_roles: {
    select: {
      roles: { select: { id: true, code: true, name_ar: true, name_en: true } },
    },
  },
  user_groups: {
    select: {
      groups: { select: { id: true, code: true, name_ar: true, name_en: true } },
    },
  },
} as const;

type UserRecord = {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  org_unit_id: number | null;
  default_organization_id: number | null;
  created_at: Date;
  updated_at: Date;
  org_units_users_org_unit_idToorg_units: { id: number; name: string; code: string | null } | null;
  user_roles: Array<{ roles: { id: number; code: string; name_ar: string; name_en: string | null } }>;
  user_groups: Array<{ groups: { id: number; code: string; name_ar: string; name_en: string | null } }>;
};

const mapUser = (user: UserRecord) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  isActive: user.is_active,
  orgUnitId: user.org_unit_id,
  defaultOrganizationId: user.default_organization_id,
  createdAt: user.created_at,
  updatedAt: user.updated_at,
  orgUnit: user.org_units_users_org_unit_idToorg_units
    ? { id: user.org_units_users_org_unit_idToorg_units.id, name: user.org_units_users_org_unit_idToorg_units.name, code: user.org_units_users_org_unit_idToorg_units.code }
    : null,
  roles: user.user_roles.map((entry) => ({
    id: entry.roles.id,
    code: entry.roles.code,
    nameAr: entry.roles.name_ar,
    nameEn: entry.roles.name_en,
  })),
  groups: user.user_groups.map((entry) => ({
    id: entry.groups.id,
    code: entry.groups.code,
    nameAr: entry.groups.name_ar,
    nameEn: entry.groups.name_en,
  })),
});

export const listUsers = async (organizationId: OrganizationId, filters: UserListFilters = {}) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  if (parsedOrganizationId === null) throw new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة');
  const page = Math.max(1, Number.parseInt(String(filters.page || ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit || ''), 10) || 20));

  const memberWhere = { organization_id: parsedOrganizationId };
  const membershipSelect = {
    user_id: true,
    users: {
      select: USER_SELECT,
    },
  } as const;

  const searchTerm =
    filters.search !== undefined ? String(filters.search).trim() : '';
  const userWhere: Record<string, unknown> = {};
  if (searchTerm) {
    userWhere.OR = [
      { full_name: { contains: searchTerm, mode: 'insensitive' as const } },
      { email: { contains: searchTerm, mode: 'insensitive' as const } },
    ];
  }
  if (filters.isActive !== undefined) {
    userWhere.is_active = filters.isActive === 'true' || filters.isActive === true;
  }

  const [rows, total] = await Promise.all([
    prisma.user_organizations.findMany({
      where: { ...memberWhere, users: userWhere },
      select: membershipSelect,
      orderBy: { users: { created_at: 'desc' } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user_organizations.count({ where: { ...memberWhere, users: userWhere } }),
  ]);

  const users = rows.map((row) => mapUser(row.users));

  return {
    data: users,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const updateUserStatus = async (
  organizationId: OrganizationId,
  userId: UserId,
  isActive: boolean,
  actorUserId: UserId
) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  const parsedUserId = toPositiveInteger(userId);
  const parsedActorUserId = toPositiveInteger(actorUserId);
  if (parsedOrganizationId === null || parsedUserId === null) throw new ApiError(404, 'المستخدم غير موجود');

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: parsedUserId, organization_id: parsedOrganizationId },
    select: { user_id: true },
  });
  if (!membership) throw new ApiError(404, 'المستخدم غير موجود ضمن مؤسستك');

  if (!isActive) {
    const admins = await prisma.user_roles.count({
      where: {
        user_id: parsedUserId,
        organization_id: parsedOrganizationId,
        roles: { code: 'admin' },
      },
    });
    if (admins > 0) {
      const remainingActiveOrgAdmins = await prisma.user_roles.count({
        where: {
          organization_id: parsedOrganizationId,
          roles: { code: 'admin' },
          users: { is_active: true },
        },
      });
      if (remainingActiveOrgAdmins <= 1) {
        throw new ApiError(400, 'لا يمكن تعطيل آخر مدير نشط في هذه المؤسسة');
      }
    }
  }

  const updated = await prisma.users.update({
    where: { id: parsedUserId },
    data: { is_active: isActive, updated_at: new Date() },
    select: USER_SELECT,
  });

  await recordAuditEvent(prisma, {
    organizationId: parsedOrganizationId,
    actorUserId: parsedActorUserId,
    action: isActive ? 'user.activated' : 'user.deactivated',
    entityType: 'user',
    entityId: updated.id,
    metadata: { isActive },
  });

  return mapUser(updated);
};

export const getUserAdministrationContext = async (organizationId: OrganizationId, userId: UserId) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  const parsedUserId = toPositiveInteger(userId);
  if (parsedOrganizationId === null || parsedUserId === null) throw new ApiError(404, 'المستخدم غير موجود');

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: parsedUserId, organization_id: parsedOrganizationId, is_active: true },
    select: { user_id: true },
  });
  if (!membership) throw new ApiError(404, 'المستخدم غير موجود ضمن مؤسستك');

  const [roleCodes, permissions] = await Promise.all([
    getEffectiveRoleCodes(parsedUserId),
    getEffectivePermissions(parsedUserId),
  ]);

  return {
    userId: parsedUserId,
    roleCodes: roleCodes.filter(
      (code) => permissions.some((permission) => permission.organizationId === parsedOrganizationId)
    ),
    permissions: permissions.filter((permission) => permission.organizationId === parsedOrganizationId),
  };
};