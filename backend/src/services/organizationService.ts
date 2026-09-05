import { Prisma, enum_organizations_anonymous_complaints_policy } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';

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
  slug?: string;
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

  if (payload.slug !== undefined) {
    const slug = payload.slug.trim().toLowerCase();
    const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!ORGANIZATION_SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 80) {
      throw new ApiError(422, 'معرّف المؤسسة (slug) غير صالح: أحرف لاتينية صغيرة وأرقام وشرطات فقط (3-80)');
    }
    if (slug !== organization.slug) {
      const existingRoot = await prisma.organizations.findFirst({
        where: { slug, parent_id: null },
        select: { id: true },
      });
      if (existingRoot) {
        throw new ApiError(409, 'معرّف المؤسسة (slug) مستخدم مسبقاً');
      }
      data.slug = slug;
    }
  }
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
  const idLabels: Record<string, string> = {
    country_id: 'الدولة',
    governorate_id: 'المحافظة',
    district_id: 'المديرية',
  };

  for (const [field, databaseField] of Object.entries(fields)) {
    const value = payload[field as keyof OrganizationUpdatePayload];
    if (value !== undefined) {
      if (idFields.includes(databaseField)) {
        data[databaseField] = parseNullableLocationId(
          value as number | string | null | undefined,
          idLabels[databaseField]
        );
      } else {
        data[databaseField] = value;
      }
    }
  }

  if (idFields.some((field) => Object.prototype.hasOwnProperty.call(data, field))) {
    const nextCountryId = data.country_id === undefined ? organization.country_id : data.country_id as number | null;
    const nextGovernorateId = data.governorate_id === undefined ? organization.governorate_id : data.governorate_id as number | null;
    const nextDistrictId = data.district_id === undefined ? organization.district_id : data.district_id as number | null;
    await validateLocationCombination(nextCountryId, nextGovernorateId, nextDistrictId);
  }

  const updated = await prisma.organizations.update({
    where: { id: parsedOrganizationId as number },
    data: data as Prisma.organizationsUpdateInput,
    select: ORGANIZATION_SELECT,
  });

  await recordAuditEvent(prisma, {
    organizationId: parsedOrganizationId,
    actorUserId: authUserId ?? null,
    action: 'organization.updated',
    entityType: 'organization',
    entityId: updated.id,
    metadata: { fields: Object.keys(payload) },
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

/**
 * Enforces the documented hierarchy contract when a unit type declares an
 * `allowed_parent_type_id`. When no parent type is declared the hierarchy
 * stays flexible (any parent inside the tenant), matching the documented
 * "flexible hierarchy" architecture in modules/organizations/README.md.
 * The Root Unit is always at hierarchy level 0 and can never be nested
 * beneath another unit.
 */
const validateNodeTypePlacement = (
  allowedParentTypeId: number | null | undefined,
  parentIsRootUnit: boolean,
  parentTypeId: number | null
): void => {
  const requiredParentTypeId = allowedParentTypeId ?? null;
  if (requiredParentTypeId === null) return;

  if (parentIsRootUnit) {
    throw new ApiError(422, 'هذا النوع من الوحدات يتطلب وحدة أم محددة ضمن المؤسسة ولا يمكن وضعه مباشرة تحت المؤسسة الجذرية');
  }
  if (parentTypeId !== requiredParentTypeId) {
    throw new ApiError(422, 'هذا النوع من الوحدات يتطلب وحدة أم من نوع محدد ضمن هذه المؤسسة');
  }
};

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

const parseNullableLocationId = (value: number | string | null | undefined, label: string): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new ApiError(422, `${label} المحددة غير صالحة`);
  return parsed;
};

const validateLocationCombination = async (
  countryId: number | null,
  governorateId: number | null,
  districtId: number | null
): Promise<void> => {
  if (governorateId !== null && countryId === null) {
    throw new ApiError(422, 'يجب تحديد الدولة مع المحافظة');
  }
  if (districtId !== null && governorateId === null) {
    throw new ApiError(422, 'يجب تحديد المحافظة مع المديرية');
  }

  if (countryId !== null) {
    const country = await prisma.countries.findFirst({ where: { id: countryId, is_active: true }, select: { id: true } });
    if (!country) throw new ApiError(422, 'الدولة المحددة غير صالحة');
  }

  if (governorateId !== null) {
    const governorate = await prisma.governorates.findFirst({
      where: { id: governorateId, country_id: countryId as number, is_active: true },
      select: { id: true },
    });
    if (!governorate) throw new ApiError(422, 'المحافظة المحددة لا تنتمي إلى الدولة المحددة');
  }

  if (districtId !== null) {
    const district = await prisma.districts.findFirst({
      where: { id: districtId, governorate_id: governorateId as number, is_active: true },
      select: { id: true },
    });
    if (!district) throw new ApiError(422, 'المديرية المحددة لا تنتمي إلى المحافظة المحددة');
  }
};

export interface CreateOrganizationPayload {
  legalName: string;
  slug: string;
  shortName?: string | null;
  description?: string | null;
  countryId?: number | string | null;
  governorateId?: number | string | null;
  districtId?: number | string | null;
  email?: string | null;
  website?: string | null;
}

const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Creates a new Organization/Tenant together with its implicit Root
 * Organizational Unit in a single atomic transaction.
 *
 * Unified hierarchy architecture: the `organizations` row itself IS the Root
 * Unit (parent_id = NULL, org_unit_type_id = NULL, root_organization_id =
 * NULL). Exactly one Root Unit per organization is therefore guaranteed by
 * construction — the Root cannot be contradictory with the organization
 * identity because it is the same row.
 *
 * The transaction also seeds the default unit types (mirroring
 * prisma/seed.ts), and grants the creating administrator an active membership
 * plus the system admin role within the new tenant so it is immediately
 * manageable.
 */
export const createOrganization = async (
  payload: CreateOrganizationPayload,
  authUserId?: number | null
): Promise<OrganizationResponse> => {
  const legalName = payload.legalName?.trim() ?? '';
  if (legalName.length < 2 || legalName.length > 200) {
    throw new ApiError(422, 'اسم المؤسسة مطلوب (2-200 حرف)');
  }

  const slug = payload.slug?.trim().toLowerCase() ?? '';
  if (!ORGANIZATION_SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 80) {
    throw new ApiError(422, 'معرّف المؤسسة (slug) غير صالح: أحرف لاتينية صغيرة وأرقام وشرطات فقط (3-80)');
  }

  const existingRoot = await prisma.organizations.findFirst({
    where: { slug, parent_id: null },
    select: { id: true },
  });
  if (existingRoot) {
    throw new ApiError(409, 'معرّف المؤسسة (slug) مستخدم مسبقاً');
  }

  const countryId = parseNullableLocationId(payload.countryId, 'الدولة');
  const governorateId = parseNullableLocationId(payload.governorateId, 'المحافظة');
  const districtId = parseNullableLocationId(payload.districtId, 'المديرية');
  await validateLocationCombination(countryId, governorateId, districtId);

  const created = await prisma.$transaction(async (tx) => {
    const now = new Date();

    // The organization record is simultaneously the tenant identity and its
    // Root Organizational Unit (parent_id and root_organization_id stay NULL).
    const organization = await tx.organizations.create({
      data: {
        legal_name: legalName,
        short_name: payload.shortName?.trim() || null,
        description: payload.description?.trim() || null,
        slug,
        country: 'Yemen',
        country_id: countryId,
        governorate_id: governorateId,
        district_id: districtId,
        email: payload.email?.trim() || null,
        website: payload.website?.trim() || null,
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        is_active: true,
        create_date: now,
        write_date: now,
        create_uid: authUserId || null,
        write_uid: authUserId || null,
      },
      select: ORGANIZATION_SELECT,
    });

    // Default unit types for the new tenant (same reference data as seed.ts),
    // so the hierarchy is ready for Branch/Sector and Department nodes.
    const branchType = await tx.org_unit_types.create({
      data: {
        organization_id: organization.id,
        code: 'branch_sector',
        name_ar: 'فرع / قطاع',
        name_en: 'Branch / Sector',
        hierarchy_level: 1,
        allowed_parent_type_id: null,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    await tx.org_unit_types.create({
      data: {
        organization_id: organization.id,
        code: 'department',
        name_ar: 'قسم',
        name_en: 'Department',
        hierarchy_level: 2,
        allowed_parent_type_id: branchType.id,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });

    if (authUserId) {
      await tx.user_organizations.create({
        data: {
          user_id: authUserId,
          organization_id: organization.id,
          is_primary: false,
          is_active: true,
          create_date: now,
          write_date: now,
        },
      });
      const adminRole = await tx.roles.findFirst({
        where: { code: 'admin', organization_id: null, is_active: true },
        select: { id: true },
      });
      if (adminRole) {
        await tx.user_roles.create({
          data: {
            user_id: authUserId,
            role_id: adminRole.id,
            organization_id: organization.id,
            create_date: now,
            write_date: now,
          },
        });
      }
    }

    await recordAuditEvent(tx, {
      organizationId: organization.id,
      actorUserId: authUserId ?? null,
      action: 'organization.created',
      entityType: 'organization',
      entityId: organization.id,
      metadata: { slug },
    });

    return organization;
  });

  return mapOrganization(created);
};

export const listOrganizationNodes = async (
  tenantOrgId: OrganizationId
): Promise<OrganizationNodeResponse[]> => {
  const rootOrgId = await resolveRootOrgId(tenantOrgId);

  // Deactivated (soft-deleted) nodes are included on purpose: the tree must be
  // able to offer reactivation for them. Active/inactive state is exposed via
  // is_active; tenant scoping is still enforced strictly by the OR clause below.
  const nodes = await prisma.organizations.findMany({
    where: {
      OR: [{ id: rootOrgId }, { root_organization_id: rootOrgId }],
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
    // Tenant scope: the type MUST be owned by the authenticated tenant root
    // organization. org_unit_types.root_organization_id is legacy and must not
    // grant ownership (it is NULL for every type created via the API).
    where: {
      id: parsedTypeId,
      organization_id: rootOrgId,
      is_active: true,
    },
  });

  if (!typeRecord) {
    throw new ApiError(422, 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة');
  }

  let effectiveParentId: number | null = null;
  let parentIsRootUnit = true;
  let parentTypeId: number | null = null;
  if (payload.parentId !== undefined && payload.parentId !== null && payload.parentId !== '') {
    const parsedParentId = Number(payload.parentId);
    if (!Number.isSafeInteger(parsedParentId) || parsedParentId <= 0) {
      throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
    }

    const parentNode = await prisma.organizations.findFirst({
      where: { id: parsedParentId, deleted_at: null },
      select: { id: true, root_organization_id: true, org_unit_type_id: true },
    });

    if (!parentNode || (parentNode.root_organization_id || parentNode.id) !== rootOrgId) {
      throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
    }

    effectiveParentId = parentNode.id;
    parentIsRootUnit = false;
    parentTypeId = parentNode.org_unit_type_id ?? null;
  } else {
    // No parent supplied: the node is attached directly beneath the Root Unit
    // of the active organization. A new node can never become a second Root.
    effectiveParentId = rootOrgId;
  }

  validateNodeTypePlacement(typeRecord.allowed_parent_type_id, parentIsRootUnit, parentTypeId);

  const countryId = parseNullableLocationId(payload.countryId, 'الدولة');
  const governorateId = parseNullableLocationId(payload.governorateId, 'المحافظة');
  const districtId = parseNullableLocationId(payload.districtId, 'المديرية');
  await validateLocationCombination(countryId, governorateId, districtId);

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
      country_id: countryId,
      governorate_id: governorateId,
      district_id: districtId,
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

  await recordAuditEvent(prisma, {
    organizationId: rootOrgId,
    actorUserId: authUserId ?? null,
    action: 'organization_node.created',
    entityType: 'organization_node',
    entityId: created.id,
    metadata: { parentId: created.parent_id, orgUnitTypeId: created.org_unit_type_id },
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
    select: { id: true, root_organization_id: true, parent_id: true, org_unit_type_id: true, country_id: true, governorate_id: true, district_id: true },
  });

  if (!node || (node.root_organization_id || node.id) !== rootOrgId) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }
  const isRootNode = parsedNodeId === rootOrgId;
  if (isRootNode && payload.isActive === false) {
    throw new ApiError(400, 'لا يمكن تعطيل المؤسسة الجذرية من مسار الهيكل التنظيمي');
  }
  if (isRootNode && payload.parentId !== undefined) {
    // Root Unit integrity (Rule B/E): the Root Unit can never be moved to
    // another parent — it always stays at hierarchy level 0 with no parent.
    throw new ApiError(400, 'لا يمكن تحريك المؤسسة الجذرية أو تغيير موقعها في الهيكل التنظيمي');
  }
  if (isRootNode && payload.orgUnitTypeId !== undefined) {
    // The Root Unit represents the organization itself; it never carries a
    // normal organizational unit type.
    throw new ApiError(400, 'لا يمكن تعيين نوع وحدة تنظيمية للمؤسسة الجذرية');
  }

  const updateData: Record<string, unknown> = { write_date: new Date() };
  if (authUserId) updateData.write_uid = authUserId;

  let nextTypeRecord: { allowed_parent_type_id: number | null } | null = null;
  let nextParentIsRoot = node.parent_id === null || node.parent_id === rootOrgId;
  let nextParentTypeId: number | null | undefined;

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
      // Tenant scope: the type MUST be owned by the authenticated tenant root
      // organization. org_unit_types.root_organization_id is legacy and must not
      // grant ownership (it is NULL for every type created via the API).
      where: {
        id: parsedTypeId,
        organization_id: rootOrgId,
        is_active: true,
      },
    });

    if (!typeRecord) {
      throw new ApiError(422, 'نوع الوحدة التنظيمية غير صالح ضمن هذه المؤسسة');
    }

    updateData.org_unit_type_id = parsedTypeId;
    nextTypeRecord = { allowed_parent_type_id: typeRecord.allowed_parent_type_id ?? null };
  }

  if (payload.parentId !== undefined) {
    if (payload.parentId === null || payload.parentId === '') {
      // Detaching a node is never allowed to create a second Root Unit:
      // clearing the parent re-attaches the node directly beneath the
      // organization Root Unit (Rules A/B/D).
      updateData.parent_id = rootOrgId;
      nextParentIsRoot = true;
      nextParentTypeId = null;
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
        select: { id: true, root_organization_id: true, org_unit_type_id: true },
      });

      if (!parentNode || (parentNode.root_organization_id || parentNode.id) !== rootOrgId) {
        throw new ApiError(422, 'الوحدة الأم المحددة غير موجودة ضمن هذه المؤسسة');
      }

      const cycle = await isDescendantNode(parsedParentId, node.id);
      if (cycle) {
        throw new ApiError(422, 'لا يمكن تعيين وحدة تابعة كأم للوحدة الحالية');
      }

      updateData.parent_id = parsedParentId;
      nextParentIsRoot = false;
      nextParentTypeId = parentNode.org_unit_type_id ?? null;
    }
  }

  if (payload.orgUnitTypeId !== undefined || payload.parentId !== undefined) {
    const effectiveTypeRecord = nextTypeRecord
      ?? (node.org_unit_type_id
        ? await prisma.org_unit_types.findUnique({
            where: { id: node.org_unit_type_id },
            select: { allowed_parent_type_id: true },
          })
        : null);

    if (effectiveTypeRecord && (effectiveTypeRecord.allowed_parent_type_id ?? null) !== null) {
      const placementParentId = typeof updateData.parent_id === 'number'
        ? updateData.parent_id
        : node.parent_id;
      if (!nextParentIsRoot && nextParentTypeId === undefined && placementParentId) {
        const parentRecord = await prisma.organizations.findUnique({
          where: { id: placementParentId },
          select: { org_unit_type_id: true },
        });
        nextParentTypeId = parentRecord?.org_unit_type_id ?? null;
      }
      validateNodeTypePlacement(effectiveTypeRecord.allowed_parent_type_id, nextParentIsRoot, nextParentTypeId ?? null);
    }
  }

  const nextCountryId = payload.countryId !== undefined
    ? parseNullableLocationId(payload.countryId, 'الدولة')
    : node.country_id;
  const nextGovernorateId = payload.governorateId !== undefined
    ? parseNullableLocationId(payload.governorateId, 'المحافظة')
    : node.governorate_id;
  const nextDistrictId = payload.districtId !== undefined
    ? parseNullableLocationId(payload.districtId, 'المديرية')
    : node.district_id;
  await validateLocationCombination(nextCountryId, nextGovernorateId, nextDistrictId);

  if (payload.countryId !== undefined) updateData.country_id = nextCountryId;
  if (payload.governorateId !== undefined) updateData.governorate_id = nextGovernorateId;
  if (payload.districtId !== undefined) updateData.district_id = nextDistrictId;

  const updated = await prisma.organizations.update({
    where: { id: node.id },
    data: updateData,
    select: NODE_SELECT,
  });

  await recordAuditEvent(prisma, {
    organizationId: rootOrgId,
    actorUserId: authUserId ?? null,
    action: 'organization_node.updated',
    entityType: 'organization_node',
    entityId: updated.id,
    metadata: { fields: Object.keys(payload) },
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
  if (parsedNodeId === rootOrgId) {
    throw new ApiError(400, 'لا يمكن تعطيل المؤسسة الجذرية من مسار الهيكل التنظيمي');
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

  await recordAuditEvent(prisma, {
    organizationId: rootOrgId,
    actorUserId: authUserId ?? null,
    action: 'organization_node.deactivated',
    entityType: 'organization_node',
    entityId: updated.id,
  });

  return mapNode(updated);
};

export const reactivateOrganizationNode = async (
  tenantOrgId: OrganizationId,
  nodeId: OrganizationId,
  authUserId?: number | null
): Promise<OrganizationNodeResponse> => {
  const rootOrgId = await resolveRootOrgId(tenantOrgId);
  const parsedNodeId = Number(nodeId);

  if (!Number.isSafeInteger(parsedNodeId) || parsedNodeId <= 0) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }

  // The node is usually soft-deleted (deactivated), so deleted_at is
  // deliberately NOT filtered here — otherwise a deactivated node could
  // never be found again.
  const node = await prisma.organizations.findFirst({
    where: { id: parsedNodeId },
    select: { id: true, root_organization_id: true, is_active: true, deleted_at: true },
  });

  if (!node || (node.root_organization_id || node.id) !== rootOrgId) {
    throw new ApiError(404, 'الوحدة التنظيمية غير موجودة');
  }
  if (parsedNodeId === rootOrgId) {
    throw new ApiError(400, 'لا يمكن تفعيل المؤسسة الجذرية من مسار الهيكل التنظيمي');
  }
  if (node.is_active && node.deleted_at === null) {
    throw new ApiError(400, 'الوحدة التنظيمية مفعّلة بالفعل');
  }

  const updated = await prisma.organizations.update({
    where: { id: node.id },
    data: {
      is_active: true,
      deleted_at: null,
      write_date: new Date(),
      ...(authUserId ? { write_uid: authUserId } : {}),
    },
    select: NODE_SELECT,
  });

  await recordAuditEvent(prisma, {
    organizationId: rootOrgId,
    actorUserId: authUserId ?? null,
    action: 'organization_node.reactivated',
    entityType: 'organization_node',
    entityId: updated.id,
  });

  return mapNode(updated);
};
