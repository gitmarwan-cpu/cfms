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
  created_at: true,
  updated_at: true,
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
    createdAt: record.created_at,
    updatedAt: record.updated_at,
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
  payload: OrganizationUpdatePayload
): Promise<OrganizationResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const organization = parsedOrganizationId
    ? await prisma.organizations.findUnique({ where: { id: parsedOrganizationId }, select: ORGANIZATION_SELECT })
    : null;

  if (!organization) throw new ApiError(404, ORGANIZATION_NOT_FOUND);

  const data: Record<string, unknown> = { updated_at: new Date() };
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

