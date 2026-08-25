import { Prisma, enum_organizations_anonymous_complaints_policy } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export type OrganizationId = string | number;

export interface OrganizationUpdatePayload {
  legalName?: string;
  shortName?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  description?: string | null;
  vision?: string | null;
  mission?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  country?: string;
  countryId?: number | string | null;
  governorateId?: number | string | null;
  districtId?: number | string | null;
  city?: string | null;
  address?: string | null;
  latitude?: Prisma.Decimal | number | string | null;
  longitude?: Prisma.Decimal | number | string | null;
  defaultLanguage?: string;
  timezone?: string;
  dateFormat?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  anonymousComplaintsPolicy?: enum_organizations_anonymous_complaints_policy;
  notificationSettings?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export interface OrganizationResponse {
  id: number;
  legalName: string;
  shortName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  description: string | null;
  vision: string | null;
  mission: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  country: string;
  countryId: number | null;
  governorateId: number | null;
  districtId: number | null;
  city: string | null;
  address: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  defaultLanguage: string;
  timezone: string;
  dateFormat: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  anonymousComplaintsPolicy: enum_organizations_anonymous_complaints_policy;
  notificationSettings: Prisma.JsonValue;
  isActive: boolean;
  createDate?: Date;
  writeDate?: Date;
  createUid?: number | null;
  writeUid?: number | null;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  governorate?: {
    id: number;
    nameAr: string;
    nameEn: string;
  } | null;
}

const ORGANIZATION_SELECT = {
  id: true,
  legal_name: true,
  short_name: true,
  logo_url: true,
  favicon_url: true,
  description: true,
  vision: true,
  mission: true,
  phone: true,
  email: true,
  website: true,
  country: true,
  country_id: true,
  governorate_id: true,
  district_id: true,
  city: true,
  address: true,
  latitude: true,
  longitude: true,
  default_language: true,
  timezone: true,
  date_format: true,
  primary_color: true,
  secondary_color: true,
  accent_color: true,
  anonymous_complaints_policy: true,
  notification_settings: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  slug: true,
} as const;

const ORGANIZATION_WITH_GOVERNORATE_SELECT = {
  ...ORGANIZATION_SELECT,
  governorates: {
    select: {
      id: true,
      name_ar: true,
      name_en: true,
    },
  },
} as const;

type OrganizationRecord = Prisma.organizationsGetPayload<{ select: typeof ORGANIZATION_SELECT }>;
type OrganizationWithGovernorate = Prisma.organizationsGetPayload<{
  select: typeof ORGANIZATION_WITH_GOVERNORATE_SELECT;
}>;

const ORGANIZATION_NOT_FOUND = 'المؤسسة غير موجودة';

const toSafeInteger = (value: OrganizationId): number | null => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const mapOrganization = (
  organization: OrganizationRecord | OrganizationWithGovernorate
): OrganizationResponse => {
  const record = organization as OrganizationRecord & {
    governorates?: OrganizationWithGovernorate['governorates'];
  };

  return {
    id: record.id,
    legalName: record.legal_name,
    shortName: record.short_name,
    logoUrl: record.logo_url,
    faviconUrl: record.favicon_url,
    description: record.description,
    vision: record.vision,
    mission: record.mission,
    phone: record.phone,
    email: record.email,
    website: record.website,
    country: record.country,
    countryId: record.country_id ?? null,
    governorateId: record.governorate_id ?? null,
    districtId: record.district_id ?? null,
    city: record.city,
    address: record.address,
    latitude: record.latitude,
    longitude: record.longitude,
    defaultLanguage: record.default_language,
    timezone: record.timezone,
    dateFormat: record.date_format,
    primaryColor: record.primary_color,
    secondaryColor: record.secondary_color,
    accentColor: record.accent_color,
    anonymousComplaintsPolicy: record.anonymous_complaints_policy,
    notificationSettings: record.notification_settings,
    isActive: record.is_active,
    createDate: record.create_date,
    writeDate: record.write_date,
    createUid: record.create_uid,
    writeUid: record.write_uid,
    createdAt: record.create_date,
    updatedAt: record.write_date,
    slug: record.slug,
    ...(record.governorates === undefined
      ? {}
      : {
          governorate: record.governorates
            ? {
                id: record.governorates.id,
                nameAr: record.governorates.name_ar,
                nameEn: record.governorates.name_en,
              }
            : null,
        }),
  };
};

export const getBySlug = async (slug: string): Promise<OrganizationResponse> => {
  const organization = await prisma.organizations.findFirst({
    where: { slug, is_active: true },
    select: ORGANIZATION_WITH_GOVERNORATE_SELECT,
  });

  if (!organization) throw new ApiError(404, ORGANIZATION_NOT_FOUND);
  return mapOrganization(organization);
};

export const getOwnOrganization = async (organizationId: OrganizationId): Promise<OrganizationResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const organization = parsedOrganizationId
    ? await prisma.organizations.findUnique({
        where: { id: parsedOrganizationId },
        select: ORGANIZATION_WITH_GOVERNORATE_SELECT,
      })
    : null;

  if (!organization) throw new ApiError(404, ORGANIZATION_NOT_FOUND);
  return mapOrganization(organization);
};

export const updateOrganization = async (
  organizationId: OrganizationId,
  payload: OrganizationUpdatePayload,
  authUserId?: number | null
): Promise<OrganizationResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const organization = parsedOrganizationId
    ? await prisma.organizations.findUnique({ where: { id: parsedOrganizationId }, select: ORGANIZATION_SELECT })
    : null;

  if (!organization) throw new ApiError(404, ORGANIZATION_NOT_FOUND);

  const data: Record<string, unknown> = { write_date: new Date() };
  if (authUserId) data.write_uid = authUserId;
  const fields = {
    legalName: 'legal_name',
    shortName: 'short_name',
    logoUrl: 'logo_url',
    faviconUrl: 'favicon_url',
    description: 'description',
    vision: 'vision',
    mission: 'mission',
    phone: 'phone',
    email: 'email',
    website: 'website',
    country: 'country',
    countryId: 'country_id',
    governorateId: 'governorate_id',
    districtId: 'district_id',
    city: 'city',
    address: 'address',
    latitude: 'latitude',
    longitude: 'longitude',
    defaultLanguage: 'default_language',
    timezone: 'timezone',
    dateFormat: 'date_format',
    primaryColor: 'primary_color',
    secondaryColor: 'secondary_color',
    accentColor: 'accent_color',
    anonymousComplaintsPolicy: 'anonymous_complaints_policy',
    notificationSettings: 'notification_settings',
    isActive: 'is_active',
  } as const;

  const idFields = ['country_id', 'governorate_id', 'district_id'];

  for (const [field, databaseField] of Object.entries(fields)) {
    const value = payload[field as keyof OrganizationUpdatePayload];
    if (value !== undefined) {
      if (idFields.includes(databaseField)) {
        if (value === null || value === '' || value === undefined) {
          data[databaseField] = null;
        } else {
          const parsedId = typeof value === 'number' ? value : Number(value);
          data[databaseField] = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
        }
      } else {
        data[databaseField] = value;
      }
    }
  }

  const updated = await prisma.organizations.update({
    where: { id: parsedOrganizationId as number },
    data: data as Prisma.organizationsUpdateInput,
    select: ORGANIZATION_SELECT,
  });

  return mapOrganization(updated);
};

export interface CreateNodePayload {
  name: string;
  orgUnitTypeId: number | string;
  parentId?: number | string | null;
  code?: string | null;
  shortName?: string | null;
  countryId?: number | string | null;
  governorateId?: number | string | null;
  districtId?: number | string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: Prisma.Decimal | number | string | null;
  longitude?: Prisma.Decimal | number | string | null;
  isActive?: boolean;
}

export interface UpdateNodePayload {
  name?: string;
  orgUnitTypeId?: number | string;
  parentId?: number | string | null;
  code?: string | null;
  shortName?: string | null;
  countryId?: number | string | null;
  governorateId?: number | string | null;
  districtId?: number | string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: Prisma.Decimal | number | string | null;
  longitude?: Prisma.Decimal | number | string | null;
  isActive?: boolean;
}

export interface OrganizationNodeResponse {
  id: number;
  name: string;
  shortName: string | null;
  code: string | null;
  parentId: number | null;
  rootOrganizationId: number | null;
  orgUnitTypeId: number | null;
  countryId: number | null;
  governorateId: number | null;
  districtId: number | null;
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
}

const NODE_SELECT = {
  id: true,
  legal_name: true,
  short_name: true,
  code: true,
  parent_id: true,
  root_organization_id: true,
  org_unit_type_id: true,
  country_id: true,
  governorate_id: true,
  district_id: true,
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
  org_unit_type: {
    select: {
      id: true,
      code: true,
      name_ar: true,
      name_en: true,
      hierarchy_level: true,
    },
  },
} as const;

type NodeRecord = Prisma.organizationsGetPayload<{ select: typeof NODE_SELECT }>;

const mapNode = (record: NodeRecord): OrganizationNodeResponse => ({
  id: record.id,
  name: record.legal_name,
  shortName: record.short_name,
  code: record.code,
  parentId: record.parent_id,
  rootOrganizationId: record.root_organization_id,
  orgUnitTypeId: record.org_unit_type_id,
  countryId: record.country_id,
  governorateId: record.governorate_id,
  districtId: record.district_id,
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
  ...(record.org_unit_type
    ? {
        unitType: {
          id: record.org_unit_type.id,
          code: record.org_unit_type.code,
          nameAr: record.org_unit_type.name_ar,
          nameEn: record.org_unit_type.name_en,
          hierarchyLevel: record.org_unit_type.hierarchy_level,
        },
      }
    : { unitType: null }),
});

const resolveRootOrgId = async (tenantOrgId: OrganizationId): Promise<number> => {
  const parsedId = toSafeInteger(tenantOrgId);
  if (!parsedId) throw new ApiError(401, 'معرف المؤسسة الفعالة غير صالح');

  const tenantOrg = await prisma.organizations.findUnique({
    where: { id: parsedId },
    select: { id: true, root_organization_id: true },
  });

  if (!tenantOrg) throw new ApiError(404, ORGANIZATION_NOT_FOUND);
  return tenantOrg.root_organization_id || tenantOrg.id;
};

const isDescendantNode = async (possibleAncestorId: number, targetNodeId: number): Promise<boolean> => {
  let currentId: number | null = possibleAncestorId;
  const visited = new Set<number>();

  while (currentId !== null) {
    if (currentId === targetNodeId) {
      return true;
    }
    if (visited.has(currentId)) {
      break;
    }
    visited.add(currentId);

    const parentNode: { parent_id: number | null } | null = await prisma.organizations.findUnique({
      where: { id: currentId },
      select: { parent_id: true },
    });

    currentId = parentNode ? parentNode.parent_id : null;
  }

  return false;
};

export const listOrganizationNodes = async (
  tenantOrgId: OrganizationId
): Promise<OrganizationNodeResponse[]> => {
  const rootOrgId = await resolveRootOrgId(tenantOrgId);

  const nodes = await prisma.organizations.findMany({
    where: {
      OR: [{ id: rootOrgId }, { root_organization_id: rootOrgId }],
      deleted_at: null,
    },
    orderBy: [{ parent_id: 'asc' }, { id: 'asc' }],
    select: NODE_SELECT,
  });

  return nodes.map(mapNode);
};

export const createOrganizationNode = async (
  tenantOrgId: OrganizationId,
  payload: CreateNodePayload,
  authUserId?: number | null
): Promise<OrganizationNodeResponse> => {
  const rootOrgId = await resolveRootOrgId(tenantOrgId);

  const parsedTypeId = Number(payload.orgUnitTypeId);
  if (!Number.isSafeInteger(parsedTypeId) || parsedTypeId <= 0) {
    throw new ApiError(422, 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة');
  }

  const typeRecord = await prisma.org_unit_types.findFirst({
    where: {
      id: parsedTypeId,
      is_active: true,
      OR: [{ root_organization_id: rootOrgId }, { organization_id: rootOrgId }, { root_organization_id: null }],
    },
  });

  if (!typeRecord) {
    throw new ApiError(422, 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة');
  }

  let effectiveParentId: number | null = null;
  if (payload.parentId !== undefined && payload.parentId !== null && payload.parentId !== '') {
    const parsedParentId = Number(payload.parentId);
    if (!Number.isSafeInteger(parsedParentId) || parsedParentId <= 0) {
      throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
    }

    const parentNode = await prisma.organizations.findFirst({
      where: { id: parsedParentId, deleted_at: null },
      select: { id: true, root_organization_id: true },
    });

    if (!parentNode || (parentNode.root_organization_id || parentNode.id) !== rootOrgId) {
      throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
    }

    effectiveParentId = parentNode.id;
  } else {
    effectiveParentId = rootOrgId;
  }

  if (payload.countryId) {
    const cid = Number(payload.countryId);
    const country = await prisma.countries.findFirst({ where: { id: cid, is_active: true } });
    if (!country) throw new ApiError(422, 'الدولة المحددة غير صالحة');
  }

  if (payload.governorateId) {
    const gid = Number(payload.governorateId);
    const gov = await prisma.governorates.findFirst({ where: { id: gid, is_active: true } });
    if (!gov) throw new ApiError(422, 'المحافظة المحددة غير صالحة');
  }

  if (payload.districtId) {
    const did = Number(payload.districtId);
    const dist = await prisma.districts.findFirst({ where: { id: did, is_active: true } });
    if (!dist) throw new ApiError(422, 'المديرية المحددة غير صالحة');
  }

  const now = new Date();
  const slug = `node-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const created = await prisma.organizations.create({
    data: {
      legal_name: payload.name.trim(),
      short_name: payload.shortName ? payload.shortName.trim() : null,
      code: payload.code ? payload.code.trim() : null,
      parent_id: effectiveParentId,
      root_organization_id: rootOrgId,
      org_unit_type_id: parsedTypeId,
      country_id: payload.countryId ? Number(payload.countryId) : null,
      governorate_id: payload.governorateId ? Number(payload.governorateId) : null,
      district_id: payload.districtId ? Number(payload.districtId) : null,
      phone: payload.phone || null,
      email: payload.email || null,
      address: payload.address || null,
      latitude: payload.latitude ? Number(payload.latitude) : null,
      longitude: payload.longitude ? Number(payload.longitude) : null,
      is_active: payload.isActive !== false,
      create_date: now,
      write_date: now,
      create_uid: authUserId || null,
      write_uid: authUserId || null,
      slug,
    },
    select: NODE_SELECT,
  });

  return mapNode(created);
};

export const updateOrganizationNode = async (
  tenantOrgId: OrganizationId,
  nodeId: OrganizationId,
  payload: UpdateNodePayload,
  authUserId?: number | null
): Promise<OrganizationNodeResponse> => {
  const rootOrgId = await resolveRootOrgId(tenantOrgId);
  const parsedNodeId = Number(nodeId);

  if (!Number.isSafeInteger(parsedNodeId) || parsedNodeId <= 0) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }

  const node = await prisma.organizations.findFirst({
    where: { id: parsedNodeId, deleted_at: null },
    select: { id: true, root_organization_id: true, parent_id: true },
  });

  if (!node || (node.root_organization_id || node.id) !== rootOrgId) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }

  const updateData: Record<string, unknown> = { write_date: new Date() };
  if (authUserId) updateData.write_uid = authUserId;

  if (payload.name !== undefined) updateData.legal_name = payload.name.trim();
  if (payload.shortName !== undefined) updateData.short_name = payload.shortName ? payload.shortName.trim() : null;
  if (payload.code !== undefined) updateData.code = payload.code ? payload.code.trim() : null;
  if (payload.phone !== undefined) updateData.phone = payload.phone || null;
  if (payload.email !== undefined) updateData.email = payload.email || null;
  if (payload.address !== undefined) updateData.address = payload.address || null;
  if (payload.latitude !== undefined) updateData.latitude = payload.latitude ? Number(payload.latitude) : null;
  if (payload.longitude !== undefined) updateData.longitude = payload.longitude ? Number(payload.longitude) : null;
  if (payload.isActive !== undefined) updateData.is_active = Boolean(payload.isActive);

  if (payload.orgUnitTypeId !== undefined) {
    const parsedTypeId = Number(payload.orgUnitTypeId);
    if (!Number.isSafeInteger(parsedTypeId) || parsedTypeId <= 0) {
      throw new ApiError(422, 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة');
    }

    const typeRecord = await prisma.org_unit_types.findFirst({
      where: {
        id: parsedTypeId,
        is_active: true,
        OR: [{ root_organization_id: rootOrgId }, { organization_id: rootOrgId }, { root_organization_id: null }],
      },
    });

    if (!typeRecord) {
      throw new ApiError(422, 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة');
    }

    updateData.org_unit_type_id = parsedTypeId;
  }

  if (payload.parentId !== undefined) {
    if (payload.parentId === null || payload.parentId === '') {
      updateData.parent_id = null;
    } else {
      const parsedParentId = Number(payload.parentId);
      if (!Number.isSafeInteger(parsedParentId) || parsedParentId <= 0) {
        throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
      }

      if (parsedParentId === node.id) {
        throw new ApiError(422, 'لا يمكن تعيين الوحدة كأب لنفسها');
      }

      const parentNode = await prisma.organizations.findFirst({
        where: { id: parsedParentId, deleted_at: null },
        select: { id: true, root_organization_id: true },
      });

      if (!parentNode || (parentNode.root_organization_id || parentNode.id) !== rootOrgId) {
        throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
      }

      const cycle = await isDescendantNode(parsedParentId, node.id);
      if (cycle) {
        throw new ApiError(422, 'لا يمكن تعيين وحدة تابعة كأم للوحدة الحالية');
      }

      updateData.parent_id = parsedParentId;
    }
  }

  if (payload.countryId !== undefined) {
    if (payload.countryId === null || payload.countryId === '') {
      updateData.country_id = null;
    } else {
      const cid = Number(payload.countryId);
      const country = await prisma.countries.findFirst({ where: { id: cid, is_active: true } });
      if (!country) throw new ApiError(422, 'الدولة المحددة غير صالحة');
      updateData.country_id = cid;
    }
  }

  if (payload.governorateId !== undefined) {
    if (payload.governorateId === null || payload.governorateId === '') {
      updateData.governorate_id = null;
    } else {
      const gid = Number(payload.governorateId);
      const gov = await prisma.governorates.findFirst({ where: { id: gid, is_active: true } });
      if (!gov) throw new ApiError(422, 'المحافظة المحددة غير صالحة');
      updateData.governorate_id = gid;
    }
  }

  if (payload.districtId !== undefined) {
    if (payload.districtId === null || payload.districtId === '') {
      updateData.district_id = null;
    } else {
      const did = Number(payload.districtId);
      const dist = await prisma.districts.findFirst({ where: { id: did, is_active: true } });
      if (!dist) throw new ApiError(422, 'المديرية المحددة غير صالحة');
      updateData.district_id = did;
    }
  }

  const updated = await prisma.organizations.update({
    where: { id: node.id },
    data: updateData,
    select: NODE_SELECT,
  });

  return mapNode(updated);
};

export const deactivateOrganizationNode = async (
  tenantOrgId: OrganizationId,
  nodeId: OrganizationId,
  authUserId?: number | null
): Promise<OrganizationNodeResponse> => {
  const rootOrgId = await resolveRootOrgId(tenantOrgId);
  const parsedNodeId = Number(nodeId);

  if (!Number.isSafeInteger(parsedNodeId) || parsedNodeId <= 0) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }

  const node = await prisma.organizations.findFirst({
    where: { id: parsedNodeId, deleted_at: null },
    select: { id: true, root_organization_id: true },
  });

  if (!node || (node.root_organization_id || node.id) !== rootOrgId) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }

  const updated = await prisma.organizations.update({
    where: { id: node.id },
    data: {
      is_active: false,
      deleted_at: new Date(),
      write_date: new Date(),
      ...(authUserId ? { write_uid: authUserId } : {}),
    },
    select: NODE_SELECT,
  });

  return mapNode(updated);
};

