import { Prisma, enum_organizations_lifecycle_status } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export interface PlatformTenantListFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  lifecycleStatus?: string;
}

const LIFECYCLE_STATUSES = [
  'provisioning',
  'active',
  'suspended',
  'deactivated',
  'archived',
] as const satisfies readonly enum_organizations_lifecycle_status[];

const TENANT_DIRECTORY_FIELDS = {
  id: true,
  legal_name: true,
  short_name: true,
  slug: true,
  country_id: true,
  governorate_id: true,
  district_id: true,
  is_active: true,
  lifecycle_status: true,
  status_changed_at: true,
  status_reason: true,
  create_date: true,
} as const;

const TENANT_DETAIL_FIELDS = {
  ...TENANT_DIRECTORY_FIELDS,
  description: true,
  email: true,
  website: true,
  write_date: true,
  status_changed_by_user_id: true,
  deleted_at: true,
  parent_id: true,
  root_organization_id: true,
  org_unit_type_id: true,
} as const;

type TenantDirectoryRecord = Prisma.organizationsGetPayload<{ select: typeof TENANT_DIRECTORY_FIELDS }>;
type TenantDetailRecord = Prisma.organizationsGetPayload<{ select: typeof TENANT_DETAIL_FIELDS }>;

const toPositiveInteger = (value: unknown, fieldName: string): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ApiError(422, `${fieldName} غير صالح`);
  return parsed;
};

const parsePage = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 1;
  return toPositiveInteger(value, 'رقم الصفحة');
};

const parseLimit = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 20;
  const parsed = toPositiveInteger(value, 'الحد الأقصى للنتائج');
  if (parsed > 100) throw new ApiError(422, 'الحد الأقصى للنتائج يجب ألا يتجاوز 100');
  return parsed;
};

const parseLifecycleStatus = (value: unknown): enum_organizations_lifecycle_status | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !LIFECYCLE_STATUSES.includes(value as typeof LIFECYCLE_STATUSES[number])) {
    throw new ApiError(422, 'حالة دورة الحياة غير صالحة');
  }
  return value as enum_organizations_lifecycle_status;
};

const mapDirectoryTenant = (organization: TenantDirectoryRecord) => ({
  id: organization.id,
  legalName: organization.legal_name,
  shortName: organization.short_name,
  slug: organization.slug,
  countryId: organization.country_id,
  governorateId: organization.governorate_id,
  districtId: organization.district_id,
  isActive: organization.is_active,
  lifecycleStatus: organization.lifecycle_status,
  statusChangedAt: organization.status_changed_at,
  statusReason: organization.status_reason,
  createdAt: organization.create_date,
});

const mapDetailTenant = (organization: TenantDetailRecord) => ({
  ...mapDirectoryTenant(organization),
  description: organization.description,
  email: organization.email,
  website: organization.website,
  writeDate: organization.write_date,
  statusChangedByUserId: organization.status_changed_by_user_id,
  deletedAt: organization.deleted_at,
  parentId: organization.parent_id,
  rootOrganizationId: organization.root_organization_id,
  orgUnitTypeId: organization.org_unit_type_id,
});

const buildRootTenantWhere = (filters: PlatformTenantListFilters): Prisma.organizationsWhereInput => {
  const where: Prisma.organizationsWhereInput = { parent_id: null };
  const lifecycleStatus = parseLifecycleStatus(filters.lifecycleStatus);
  if (lifecycleStatus) where.lifecycle_status = lifecycleStatus;

  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  if (search) {
    where.OR = [
      { legal_name: { contains: search, mode: 'insensitive' } },
      { short_name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

export const listTenants = async (filters: PlatformTenantListFilters = {}) => {
  const page = parsePage(filters.page);
  const limit = parseLimit(filters.limit);
  const where = buildRootTenantWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.organizations.findMany({
      where,
      select: TENANT_DIRECTORY_FIELDS,
      orderBy: [{ create_date: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organizations.count({ where }),
  ]);

  return {
    data: rows.map(mapDirectoryTenant),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const getTenant = async (organizationId: unknown) => {
  const parsedOrganizationId = toPositiveInteger(organizationId, 'معرّف المؤسسة');
  const organization = await prisma.organizations.findFirst({
    where: { id: parsedOrganizationId, parent_id: null },
    select: TENANT_DETAIL_FIELDS,
  });

  if (!organization) throw new ApiError(404, 'المؤسسة غير موجودة');
  return mapDetailTenant(organization);
};

export { LIFECYCLE_STATUSES };
