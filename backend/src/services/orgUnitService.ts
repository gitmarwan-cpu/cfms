import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export type OrganizationId = string | number;
export type OrgUnitId = string | number;

export interface OrgUnitPayload {
  orgUnitTypeId: string | number;
  parentId?: string | number | null;
  name: string;
  code?: string | null;
  managerUserId?: string | number | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: Prisma.Decimal | number | string | null;
  longitude?: Prisma.Decimal | number | string | null;
  isActive?: boolean;
}

export interface OrgUnitUpdatePayload {
  orgUnitTypeId?: string | number;
  parentId?: string | number | null;
  name?: string;
  code?: string | null;
  managerUserId?: string | number | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: Prisma.Decimal | number | string | null;
  longitude?: Prisma.Decimal | number | string | null;
  isActive?: boolean;
}

export interface OrgUnitResponse {
  id: number;
  organizationId: number;
  orgUnitTypeId: number;
  parentId: number | null;
  name: string;
  code: string | null;
  managerUserId: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  isActive: boolean;
  createDate?: Date;
  writeDate?: Date;
  createUid?: number | null;
  writeUid?: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  unitType?: {
    id: number;
    code: string;
    nameAr: string;
    nameEn: string | null;
    hierarchyLevel: number;
  } | null;
  manager?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

const UNIT_SELECT = {
  id: true,
  organization_id: true,
  org_unit_type_id: true,
  parent_id: true,
  name: true,
  code: true,
  manager_user_id: true,
  phone: true,
  email: true,
  address: true,
  latitude: true,
  longitude: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  deleted_at: true,
} as const;

const UNIT_WITH_RELATIONS_SELECT = {
  ...UNIT_SELECT,
  org_unit_types: {
    select: { id: true, code: true, name_ar: true, name_en: true, hierarchy_level: true },
  },
  users_org_units_manager_user_idTousers: {
    select: { id: true, full_name: true, email: true },
  },
} as const;

const UNIT_NOT_FOUND = 'الوحدة التنظيمية غير موجودة';
const INVALID_TYPE = 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة';
const INVALID_PARENT = 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة';
const INVALID_MANAGER = 'المستخدم المحدد كمدير للوحدة ليس عضواً في هذه المؤسسة';

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

type UnitRecord = Prisma.org_unitsGetPayload<{ select: typeof UNIT_SELECT }>;
type UnitWithRelations = Prisma.org_unitsGetPayload<{ select: typeof UNIT_WITH_RELATIONS_SELECT }>;

const mapUnit = (unit: UnitRecord | UnitWithRelations): OrgUnitResponse => {
  const record = unit as UnitRecord & {
    org_unit_types?: UnitWithRelations['org_unit_types'];
    users_org_units_manager_user_idTousers?: UnitWithRelations['users_org_units_manager_user_idTousers'];
  };

  return {
    id: record.id,
    organizationId: record.organization_id,
    orgUnitTypeId: record.org_unit_type_id,
    parentId: record.parent_id,
    name: record.name,
    code: record.code,
    managerUserId: record.manager_user_id,
    phone: record.phone,
    email: record.email,
    address: record.address,
    latitude: record.latitude,
    longitude: record.longitude,
    isActive: record.is_active,
    createDate: record.create_date,
    writeDate: record.write_date,
    createUid: record.create_uid,
    writeUid: record.write_uid,
    createdAt: record.create_date,
    updatedAt: record.write_date,
    deletedAt: record.deleted_at,
    ...(record.org_unit_types === undefined
      ? {}
      : {
          unitType: {
            id: record.org_unit_types.id,
            code: record.org_unit_types.code,
            nameAr: record.org_unit_types.name_ar,
            nameEn: record.org_unit_types.name_en,
            hierarchyLevel: record.org_unit_types.hierarchy_level,
          },
        }),
    ...(record.users_org_units_manager_user_idTousers === undefined
      ? {}
      : {
          manager: record.users_org_units_manager_user_idTousers
            ? {
                id: record.users_org_units_manager_user_idTousers.id,
                fullName: record.users_org_units_manager_user_idTousers.full_name,
                email: record.users_org_units_manager_user_idTousers.email,
              }
            : null,
        }),
  };
};

const validateManagerBelongsToOrganization = async (
  managerUserId: number | null,
  organizationId: number
): Promise<void> => {
  if (!managerUserId) return;

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: managerUserId, organization_id: organizationId, is_active: true },
    select: { id: true },
  });
  if (!membership) throw new ApiError(422, INVALID_MANAGER);
};

const validateParentTypeCompatibility = async (
  orgUnitTypeId: number,
  parentId: number | null,
  organizationId: number
): Promise<void> => {
  const unitType = await prisma.org_unit_types.findFirst({
    where: { id: orgUnitTypeId, organization_id: organizationId },
    select: { allowed_parent_type_id: true },
  });
  if (!unitType) throw new ApiError(422, INVALID_TYPE);

  if (!parentId) {
    if (unitType.allowed_parent_type_id) {
      throw new ApiError(422, 'هذا النوع من الوحدات لا يمكن إلحاقه مباشرة بالمؤسسة، يجب تحديد وحدة أم');
    }
    return;
  }

  const parentUnit = await prisma.org_units.findFirst({
    where: { id: parentId, organization_id: organizationId, deleted_at: null },
    select: { org_unit_type_id: true },
  });
  if (!parentUnit) throw new ApiError(422, INVALID_PARENT);

  if (unitType.allowed_parent_type_id && unitType.allowed_parent_type_id !== parentUnit.org_unit_type_id) {
    throw new ApiError(
      422,
      'نوع الوحدة الأم لا يتوافق مع الهيكل التنظيمي المعرّف لهذا النوع من الوحدات'
    );
  }
};

export const listUnits = async (organizationId: OrganizationId): Promise<OrgUnitResponse[]> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) return [];

  const units = await prisma.org_units.findMany({
    where: { organization_id: parsedOrganizationId, deleted_at: null },
    orderBy: { id: 'asc' },
    select: UNIT_WITH_RELATIONS_SELECT,
  });
  return units.map(mapUnit);
};

export const createUnit = async (
  organizationId: OrganizationId,
  payload: OrgUnitPayload
): Promise<OrgUnitResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedTypeId = toSafeInteger(payload.orgUnitTypeId);
  const parsedParentId = optionalId(payload.parentId);
  const parsedManagerId = optionalId(payload.managerUserId);
  if (!parsedOrganizationId || !parsedTypeId || (payload.parentId != null && parsedParentId === null)) {
    throw new ApiError(422, INVALID_TYPE);
  }
  if (payload.managerUserId != null && parsedManagerId === null) throw new ApiError(422, INVALID_MANAGER);

  await validateParentTypeCompatibility(parsedTypeId, parsedParentId, parsedOrganizationId);
  await validateManagerBelongsToOrganization(parsedManagerId, parsedOrganizationId);

  const unit = await prisma.org_units.create({
    data: {
      organization_id: parsedOrganizationId,
      org_unit_type_id: parsedTypeId,
      parent_id: parsedParentId,
      name: payload.name,
      code: payload.code || null,
      manager_user_id: parsedManagerId,
      phone: payload.phone || null,
      email: payload.email || null,
      address: payload.address || null,
      latitude: payload.latitude || null,
      longitude: payload.longitude || null,
      is_active: payload.isActive !== undefined ? payload.isActive : true,
      create_date: new Date(),
      write_date: new Date(),
    },
    select: UNIT_SELECT,
  });
  return mapUnit(unit);
};

export const updateUnit = async (
  organizationId: OrganizationId,
  unitId: OrgUnitId,
  payload: OrgUnitUpdatePayload
): Promise<OrgUnitResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUnitId = toSafeInteger(unitId);
  const unit = parsedOrganizationId && parsedUnitId
    ? await prisma.org_units.findFirst({
        where: { id: parsedUnitId, organization_id: parsedOrganizationId, deleted_at: null },
        select: UNIT_SELECT,
      })
    : null;
  if (!unit) throw new ApiError(404, UNIT_NOT_FOUND);

  const nextTypeId = payload.orgUnitTypeId !== undefined
    ? toSafeInteger(payload.orgUnitTypeId)
    : unit.org_unit_type_id;
  const nextParentId = payload.parentId !== undefined ? optionalId(payload.parentId) : unit.parent_id;
  if (!nextTypeId || (payload.parentId != null && nextParentId === null)) throw new ApiError(422, INVALID_TYPE);
  if (nextParentId === unit.id) throw new ApiError(422, 'لا يمكن أن تكون الوحدة أباً لنفسها');

  if (payload.orgUnitTypeId !== undefined || payload.parentId !== undefined) {
    await validateParentTypeCompatibility(nextTypeId, nextParentId, parsedOrganizationId as number);
  }

  if (payload.managerUserId !== undefined) {
    const nextManagerId = optionalId(payload.managerUserId);
    if (payload.managerUserId !== null && nextManagerId === null) throw new ApiError(422, INVALID_MANAGER);
    await validateManagerBelongsToOrganization(nextManagerId, parsedOrganizationId as number);
  }

  const data: Record<string, unknown> = { write_date: new Date() };
  if (payload.orgUnitTypeId !== undefined) data.org_unit_type_id = nextTypeId;
  if (payload.parentId !== undefined) data.parent_id = nextParentId;
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.code !== undefined) data.code = payload.code;
  if (payload.managerUserId !== undefined) data.manager_user_id = optionalId(payload.managerUserId);
  if (payload.phone !== undefined) data.phone = payload.phone;
  if (payload.email !== undefined) data.email = payload.email;
  if (payload.address !== undefined) data.address = payload.address;
  if (payload.latitude !== undefined) data.latitude = payload.latitude;
  if (payload.longitude !== undefined) data.longitude = payload.longitude;
  if (payload.isActive !== undefined) data.is_active = payload.isActive;

  const updated = await prisma.org_units.update({
    where: { id: parsedUnitId as number },
    data: data as Parameters<typeof prisma.org_units.update>[0]['data'],
    select: UNIT_SELECT,
  });
  return mapUnit(updated);
};

export const deactivateUnit = async (
  organizationId: OrganizationId,
  unitId: OrgUnitId
): Promise<OrgUnitResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUnitId = toSafeInteger(unitId);
  const unit = parsedOrganizationId && parsedUnitId
    ? await prisma.org_units.findFirst({
        where: { id: parsedUnitId, organization_id: parsedOrganizationId, deleted_at: null },
        select: { id: true },
      })
    : null;
  if (!unit) throw new ApiError(404, UNIT_NOT_FOUND);

  const activeChildren = await prisma.org_units.count({
    where: { parent_id: parsedUnitId as number, is_active: true, deleted_at: null },
  });
  if (activeChildren > 0) {
    throw new ApiError(409, 'لا يمكن إلغاء تفعيل وحدة لديها وحدات فرعية نشطة تابعة لها');
  }

  const deactivated = await prisma.org_units.update({
    where: { id: parsedUnitId as number },
    data: { is_active: false, deleted_at: new Date(), write_date: new Date() },
    select: UNIT_SELECT,
  });

  return mapUnit(deactivated);
};
