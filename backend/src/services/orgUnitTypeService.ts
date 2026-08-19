import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export type OrganizationId = string | number;
export type OrgUnitTypeId = string | number;

export interface OrgUnitTypePayload {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  hierarchyLevel?: number | string;
  allowedParentTypeId?: OrgUnitTypeId | null;
  isActive?: boolean;
}

export interface OrgUnitTypeUpdatePayload {
  nameAr?: string;
  nameEn?: string | null;
  hierarchyLevel?: number | string;
  allowedParentTypeId?: OrgUnitTypeId | null;
  isActive?: boolean;
}

export interface OrgUnitTypeResponse {
  id: number;
  organizationId: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
  hierarchyLevel: number;
  allowedParentTypeId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TYPE_SELECT = {
  id: true,
  organization_id: true,
  code: true,
  name_ar: true,
  name_en: true,
  hierarchy_level: true,
  allowed_parent_type_id: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

const TYPE_NOT_FOUND = 'نوع الوحدة التنظيمية غير موجود';
const PARENT_TYPE_NOT_FOUND = 'نوع الأصل المحدد غير موجود ضمن هذه المؤسسة';

const toSafeInteger = (value: OrganizationId | OrgUnitTypeId): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const toHierarchyLevel = (value: number | string | undefined): number => {
  if (value === undefined) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};

const mapType = (type: {
  id: number;
  organization_id: number;
  code: string;
  name_ar: string;
  name_en: string | null;
  hierarchy_level: number;
  allowed_parent_type_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}): OrgUnitTypeResponse => ({
  id: type.id,
  organizationId: type.organization_id,
  code: type.code,
  nameAr: type.name_ar,
  nameEn: type.name_en,
  hierarchyLevel: type.hierarchy_level,
  allowedParentTypeId: type.allowed_parent_type_id,
  isActive: type.is_active,
  createdAt: type.created_at,
  updatedAt: type.updated_at,
});

export const listTypes = async (organizationId: OrganizationId): Promise<OrgUnitTypeResponse[]> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) return [];

  const types = await prisma.org_unit_types.findMany({
    where: { organization_id: parsedOrganizationId },
    orderBy: [{ hierarchy_level: 'asc' }, { id: 'asc' }],
    select: TYPE_SELECT,
  });

  return types.map(mapType);
};

export const createType = async (
  organizationId: OrganizationId,
  payload: OrgUnitTypePayload
): Promise<OrgUnitTypeResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) throw new ApiError(422, TYPE_NOT_FOUND);

  const existing = await prisma.org_unit_types.findFirst({
    where: { organization_id: parsedOrganizationId, code: payload.code },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, 'الرمز (code) مستخدم بالفعل لنوع آخر ضمن هذه المؤسسة');

  const parsedParentTypeId = payload.allowedParentTypeId
    ? toSafeInteger(payload.allowedParentTypeId)
    : null;
  if (payload.allowedParentTypeId && parsedParentTypeId === null) {
    throw new ApiError(422, PARENT_TYPE_NOT_FOUND);
  }
  if (parsedParentTypeId !== null) {
    const parentType = await prisma.org_unit_types.findFirst({
      where: { id: parsedParentTypeId, organization_id: parsedOrganizationId },
      select: { id: true },
    });
    if (!parentType) throw new ApiError(422, PARENT_TYPE_NOT_FOUND);
  }

  const type = await prisma.org_unit_types.create({
    data: {
      organization_id: parsedOrganizationId,
      code: payload.code,
      name_ar: payload.nameAr,
      name_en: payload.nameEn || null,
      hierarchy_level: toHierarchyLevel(payload.hierarchyLevel),
      allowed_parent_type_id: parsedParentTypeId,
      is_active: payload.isActive !== undefined ? payload.isActive : true,
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: TYPE_SELECT,
  });

  return mapType(type);
};

export const updateType = async (
  organizationId: OrganizationId,
  typeId: OrgUnitTypeId,
  payload: OrgUnitTypeUpdatePayload
): Promise<OrgUnitTypeResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedTypeId = toSafeInteger(typeId);
  const type = parsedOrganizationId && parsedTypeId
    ? await prisma.org_unit_types.findFirst({
        where: { id: parsedTypeId, organization_id: parsedOrganizationId },
        select: TYPE_SELECT,
      })
    : null;
  if (!type) throw new ApiError(404, TYPE_NOT_FOUND);

  let parsedParentTypeId: number | null | undefined;
  if (payload.allowedParentTypeId !== undefined && payload.allowedParentTypeId !== null) {
    parsedParentTypeId = toSafeInteger(payload.allowedParentTypeId);
    if (parsedParentTypeId === null) throw new ApiError(422, PARENT_TYPE_NOT_FOUND);
    const parentType = await prisma.org_unit_types.findFirst({
      where: { id: parsedParentTypeId, organization_id: parsedOrganizationId as number },
      select: { id: true },
    });
    if (!parentType) throw new ApiError(422, PARENT_TYPE_NOT_FOUND);
  } else if (payload.allowedParentTypeId === null) {
    parsedParentTypeId = null;
  }

  const data: Record<string, unknown> = { updated_at: new Date() };
  if (payload.nameAr !== undefined) data.name_ar = payload.nameAr;
  if (payload.nameEn !== undefined) data.name_en = payload.nameEn;
  if (payload.hierarchyLevel !== undefined) data.hierarchy_level = toHierarchyLevel(payload.hierarchyLevel);
  if (parsedParentTypeId !== undefined) data.allowed_parent_type_id = parsedParentTypeId;
  if (payload.isActive !== undefined) data.is_active = payload.isActive;

  const updated = await prisma.org_unit_types.update({
    where: { id: parsedTypeId as number },
    data: data as Parameters<typeof prisma.org_unit_types.update>[0]['data'],
    select: TYPE_SELECT,
  });

  return mapType(updated);
};
