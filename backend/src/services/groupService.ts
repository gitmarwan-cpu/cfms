import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export type OrganizationId = string | number;
export type GroupId = string | number;

export interface GroupPayload {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  roleIds?: Array<string | number>;
}

export interface GroupUpdatePayload {
  nameAr?: string;
  nameEn?: string | null;
  description?: string | null;
  isActive?: boolean;
  roleIds?: Array<string | number>;
}

export interface GroupRoleResponse {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
}

export interface GroupResponse {
  id: number;
  code: string;
  organizationId: number | null;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles?: GroupRoleResponse[];
}

const GROUP_SELECT = {
  id: true,
  code: true,
  organization_id: true,
  name_ar: true,
  name_en: true,
  description: true,
  is_system: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

const GROUP_WITH_ROLES_SELECT = {
  ...GROUP_SELECT,
  group_roles: {
    select: { roles: { select: { id: true, code: true, name_ar: true, name_en: true } } },
  },
} as const;

const toSafeInteger = (value: OrganizationId | GroupId): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const mapGroup = (group: any): GroupResponse => ({
  id: group.id,
  code: group.code,
  organizationId: group.organization_id,
  nameAr: group.name_ar,
  nameEn: group.name_en,
  description: group.description,
  isSystem: group.is_system,
  isActive: group.is_active,
  createdAt: group.created_at,
  updatedAt: group.updated_at,
  ...(group.group_roles === undefined
    ? {}
    : {
        roles: group.group_roles.map((entry: any) => ({
          id: entry.roles.id,
          code: entry.roles.code,
          nameAr: entry.roles.name_ar,
          nameEn: entry.roles.name_en,
        })),
      }),
});

const visibleGroupWhere = (organizationId: number) => ({
  OR: [{ organization_id: null }, { organization_id: organizationId }],
});

const visibleRoleWhere = (organizationId: number) => ({
  OR: [{ organization_id: null }, { organization_id: organizationId }],
});

const loadGroup = async (organizationId: number, id: number): Promise<GroupResponse> => {
  const group = await prisma.groups.findFirst({
    where: { id, ...visibleGroupWhere(organizationId) },
    select: GROUP_WITH_ROLES_SELECT,
  });
  if (!group) throw new ApiError(404, 'المجموعة غير موجودة');
  return mapGroup(group);
};

const replaceGroupRoles = async (groupId: number, roleIds: number[]): Promise<void> => {
  await prisma.group_roles.deleteMany({ where: { group_id: groupId } });
  if (!roleIds.length) return;
  await prisma.group_roles.createMany({
    data: roleIds.map((role_id) => ({ group_id: groupId, role_id, created_at: new Date() })),
    skipDuplicates: true,
  });
};

export const listGroups = async (organizationId: OrganizationId): Promise<GroupResponse[]> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) return [];
  const groups = await prisma.groups.findMany({
    where: visibleGroupWhere(parsedOrganizationId),
    orderBy: { id: 'asc' },
    select: GROUP_WITH_ROLES_SELECT,
  });
  return groups.map(mapGroup);
};

export const getGroupById = async (organizationId: OrganizationId, id: GroupId): Promise<GroupResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedId = toSafeInteger(id);
  if (parsedOrganizationId === null || parsedId === null) throw new ApiError(404, 'المجموعة غير موجودة');
  return loadGroup(parsedOrganizationId, parsedId);
};

export const createGroup = async (organizationId: OrganizationId, payload: GroupPayload): Promise<GroupResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) throw new ApiError(422, 'المؤسسة غير موجودة');
  const existing = await prisma.groups.findFirst({ where: { code: payload.code, organization_id: parsedOrganizationId } });
  if (existing) throw new ApiError(409, 'يوجد مجموعة بنفس الكود مسبقاً في مؤسستك');

  const group = await prisma.groups.create({
    data: {
      code: payload.code,
      name_ar: payload.nameAr,
      name_en: payload.nameEn,
      description: payload.description,
      is_system: false,
      is_active: true,
      organization_id: parsedOrganizationId,
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: GROUP_SELECT,
  });
  if (Array.isArray(payload.roleIds) && payload.roleIds.length) {
    await assignRolesToGroup(parsedOrganizationId, group.id, payload.roleIds);
  }
  return loadGroup(parsedOrganizationId, group.id);
};

export const updateGroup = async (
  organizationId: OrganizationId,
  id: GroupId,
  payload: GroupUpdatePayload
): Promise<GroupResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedId = toSafeInteger(id);
  const group = parsedId ? await prisma.groups.findUnique({ where: { id: parsedId }, select: GROUP_SELECT }) : null;
  if (!group || (group.organization_id !== null && group.organization_id !== parsedOrganizationId)) {
    throw new ApiError(404, 'المجموعة غير موجودة');
  }
  if (group.is_system) throw new ApiError(403, 'لا يمكن تعديل المجموعات النظامية');

  const data: Record<string, unknown> = { updated_at: new Date() };
  if (payload.nameAr !== undefined) data.name_ar = payload.nameAr;
  if (payload.nameEn !== undefined) data.name_en = payload.nameEn;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.isActive !== undefined) data.is_active = payload.isActive;
  await prisma.groups.update({ where: { id: parsedId as number }, data: data as any });

  if (Array.isArray(payload.roleIds)) await assignRolesToGroup(parsedOrganizationId as number, parsedId as number, payload.roleIds);
  return loadGroup(parsedOrganizationId as number, parsedId as number);
};

export const deleteGroup = async (organizationId: OrganizationId, id: GroupId): Promise<void> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedId = toSafeInteger(id);
  const group = parsedId ? await prisma.groups.findUnique({ where: { id: parsedId }, select: GROUP_SELECT }) : null;
  if (!group || (group.organization_id !== null && group.organization_id !== parsedOrganizationId)) {
    throw new ApiError(404, 'المجموعة غير موجودة');
  }
  if (group.is_system) throw new ApiError(403, 'لا يمكن حذف المجموعات النظامية');
  const membersCount = await prisma.user_groups.count({ where: { group_id: parsedId as number } });
  if (membersCount > 0) throw new ApiError(400, 'لا يمكن حذف مجموعة بها أعضاء حالياً؛ أزل الأعضاء أولاً');
  await prisma.groups.delete({ where: { id: parsedId as number } });
};

export const assignRolesToGroup = async (
  organizationId: OrganizationId,
  groupId: GroupId,
  roleIds: Array<string | number>
): Promise<GroupResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedGroupId = toSafeInteger(groupId);
  if (parsedOrganizationId === null || parsedGroupId === null) throw new ApiError(404, 'المجموعة غير موجودة');

  const group = await prisma.groups.findUnique({ where: { id: parsedGroupId }, select: GROUP_SELECT });
  if (!group || (group.organization_id !== null && group.organization_id !== parsedOrganizationId)) {
    throw new ApiError(404, 'المجموعة غير موجودة');
  }

  const parsedRoleIds = roleIds.map((id) => toSafeInteger(id));
  if (parsedRoleIds.some((id) => id === null)) throw new ApiError(422, 'أحد الأدوار المحددة غير موجود أو لا يخص مؤسستك');
  if (parsedRoleIds.length > 0) {
    const validRoles = await prisma.roles.findMany({
      where: { id: { in: parsedRoleIds as number[] }, ...visibleRoleWhere(parsedOrganizationId) },
      select: { id: true },
    });
    if (validRoles.length !== parsedRoleIds.length) {
      throw new ApiError(422, 'أحد الأدوار المحددة غير موجود أو لا يخص مؤسستك');
    }
  }

  await replaceGroupRoles(parsedGroupId, parsedRoleIds as number[]);
  return loadGroup(parsedOrganizationId, parsedGroupId);
};
