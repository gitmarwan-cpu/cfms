import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export type OrganizationId = string | number;
export type RoleId = string | number;

export interface RolePayload {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  permissionIds?: Array<string | number>;
}

export interface RoleUpdatePayload {
  nameAr?: string;
  nameEn?: string | null;
  description?: string | null;
  isActive?: boolean;
  permissionIds?: Array<string | number>;
}

export interface PermissionResponse {
  id: number;
  code: string;
  module: string;
  descriptionAr: string | null;
  createDate: Date;
  writeDate: Date;
  createUid: number | null;
  writeUid: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleResponse {
  id: number;
  code: string;
  organizationId: number | null;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createDate: Date;
  writeDate: Date;
  createUid: number | null;
  writeUid: number | null;
  createdAt: Date;
  updatedAt: Date;
  permissions?: PermissionResponse[];
}

const ROLE_SELECT = {
  id: true,
  code: true,
  organization_id: true,
  name_ar: true,
  name_en: true,
  description: true,
  is_system: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
} as const;

const ROLE_WITH_PERMISSIONS_SELECT = {
  ...ROLE_SELECT,
  role_permissions: {
    select: {
      permissions: {
        select: {
          id: true,
          code: true,
          module: true,
          description_ar: true,
          create_date: true,
          write_date: true,
          create_uid: true,
          write_uid: true,
        },
      },
    },
  },
} as const;

const toSafeInteger = (value: OrganizationId | RoleId): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const mapPermission = (permission: any): PermissionResponse => ({
  id: permission.id,
  code: permission.code,
  module: permission.module,
  descriptionAr: permission.description_ar,
  createDate: permission.create_date,
  writeDate: permission.write_date,
  createUid: permission.create_uid,
  writeUid: permission.write_uid,
  createdAt: permission.create_date,
  updatedAt: permission.write_date,
});

const mapRole = (role: any): RoleResponse => ({
  id: role.id,
  code: role.code,
  organizationId: role.organization_id,
  nameAr: role.name_ar,
  nameEn: role.name_en,
  description: role.description,
  isSystem: role.is_system,
  isActive: role.is_active,
  createDate: role.create_date,
  writeDate: role.write_date,
  createUid: role.create_uid,
  writeUid: role.write_uid,
  createdAt: role.create_date,
  updatedAt: role.write_date,
  ...(role.role_permissions === undefined
    ? {}
    : { permissions: role.role_permissions.map((entry: any) => mapPermission(entry.permissions)) }),
});

const visibleRoleWhere = (organizationId: number) => ({
  OR: [{ organization_id: null }, { organization_id: organizationId }],
});

const loadRole = async (organizationId: number, id: number): Promise<RoleResponse> => {
  const role = await prisma.roles.findFirst({
    where: { id, ...visibleRoleWhere(organizationId) },
    select: ROLE_WITH_PERMISSIONS_SELECT,
  });
  if (!role) throw new ApiError(404, 'الدور غير موجود');
  return mapRole(role);
};

const replaceRolePermissions = async (roleId: number, permissionIds: number[]): Promise<void> => {
  await prisma.role_permissions.deleteMany({ where: { role_id: roleId } });
  if (permissionIds.length === 0) return;
  await prisma.role_permissions.createMany({
    data: permissionIds.map((permission_id) => ({ role_id: roleId, permission_id, created_at: new Date() })),
    skipDuplicates: true,
  });
};

export const listRoles = async (organizationId: OrganizationId): Promise<RoleResponse[]> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) return [];

  const roles = await prisma.roles.findMany({
    where: visibleRoleWhere(parsedOrganizationId),
    orderBy: { id: 'asc' },
    select: ROLE_WITH_PERMISSIONS_SELECT,
  });
  return roles.map(mapRole);
};

export const getRoleById = async (organizationId: OrganizationId, id: RoleId): Promise<RoleResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedId = toSafeInteger(id);
  if (parsedOrganizationId === null || parsedId === null) throw new ApiError(404, 'الدور غير موجود');
  return loadRole(parsedOrganizationId, parsedId);
};

export const createRole = async (organizationId: OrganizationId, payload: RolePayload): Promise<RoleResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) throw new ApiError(422, 'المؤسسة غير موجودة');
  const existing = await prisma.roles.findFirst({ where: { code: payload.code, organization_id: parsedOrganizationId } });
  if (existing) throw new ApiError(409, 'يوجد دور بنفس الكود مسبقاً في مؤسستك');

  const now = new Date();
  const role = await prisma.roles.create({
    data: {
      code: payload.code,
      name_ar: payload.nameAr,
      name_en: payload.nameEn,
      description: payload.description,
      is_system: false,
      is_active: true,
      organization_id: parsedOrganizationId,
      create_date: now,
      write_date: now,
    },
    select: ROLE_SELECT,
  });
  if (Array.isArray(payload.permissionIds) && payload.permissionIds.length) {
    await replaceRolePermissions(role.id, payload.permissionIds.map((id) => toSafeInteger(id) as number));
  }
  return loadRole(parsedOrganizationId, role.id);
};

export const updateRole = async (
  organizationId: OrganizationId,
  id: RoleId,
  payload: RoleUpdatePayload
): Promise<RoleResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedId = toSafeInteger(id);
  const role = parsedId
    ? await prisma.roles.findUnique({ where: { id: parsedId }, select: ROLE_SELECT })
    : null;
  if (!role || (role.organization_id !== null && role.organization_id !== parsedOrganizationId)) {
    throw new ApiError(404, 'الدور غير موجود');
  }
  if (role.is_system) throw new ApiError(403, 'لا يمكن تعديل الأدوار النظامية (admin/staff)');

  const data: Record<string, unknown> = { write_date: new Date() };
  if (payload.nameAr !== undefined) data.name_ar = payload.nameAr;
  if (payload.nameEn !== undefined) data.name_en = payload.nameEn;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.isActive !== undefined) data.is_active = payload.isActive;
  await prisma.roles.update({ where: { id: parsedId as number }, data: data as any });

  if (Array.isArray(payload.permissionIds)) {
    await replaceRolePermissions(parsedId as number, payload.permissionIds.map((permissionId) => toSafeInteger(permissionId) as number));
  }
  return loadRole(parsedOrganizationId as number, parsedId as number);
};

export const deleteRole = async (organizationId: OrganizationId, id: RoleId): Promise<void> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedId = toSafeInteger(id);
  const role = parsedId ? await prisma.roles.findUnique({ where: { id: parsedId }, select: ROLE_SELECT }) : null;
  if (!role || (role.organization_id !== null && role.organization_id !== parsedOrganizationId)) {
    throw new ApiError(404, 'الدور غير موجود');
  }
  if (role.is_system) throw new ApiError(403, 'لا يمكن حذف الأدوار النظامية (admin/staff)');

  const assignmentsCount = await prisma.user_roles.count({ where: { role_id: parsedId as number } });
  if (assignmentsCount > 0) {
    throw new ApiError(400, 'لا يمكن حذف دور مُسند حالياً لمستخدمين؛ ألغِ التعيينات أولاً');
  }
  await prisma.roles.delete({ where: { id: parsedId as number } });
};

export const listPermissions = async (): Promise<PermissionResponse[]> => {
  const permissions = await prisma.permissions.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  return permissions.map(mapPermission);
};
