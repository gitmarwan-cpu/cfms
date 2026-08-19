import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

const mapOrganization = (organization: any) => ({
  id: organization.id,
  legalName: organization.legal_name,
  shortName: organization.short_name,
  logoUrl: organization.logo_url,
  faviconUrl: organization.favicon_url,
  description: organization.description,
  vision: organization.vision,
  mission: organization.mission,
  phone: organization.phone,
  email: organization.email,
  website: organization.website,
  country: organization.country,
  governorateId: organization.governorate_id,
  city: organization.city,
  address: organization.address,
  latitude: organization.latitude,
  longitude: organization.longitude,
  defaultLanguage: organization.default_language,
  timezone: organization.timezone,
  dateFormat: organization.date_format,
  primaryColor: organization.primary_color,
  secondaryColor: organization.secondary_color,
  accentColor: organization.accent_color,
  anonymousComplaintsPolicy: organization.anonymous_complaints_policy,
  notificationSettings: organization.notification_settings,
  isActive: organization.is_active,
  createdAt: organization.created_at,
  updatedAt: organization.updated_at,
  slug: organization.slug,
});

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
  governorate_id: true,
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

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const resolvePublicTenant = async (req: any, res: any, next: (error?: unknown) => void): Promise<void> => {
  try {
    const slug = req.params.orgSlug;
    if (!slug) throw new ApiError(400, 'معرّف المؤسسة (orgSlug) مطلوب في الرابط');

    const organization = await prisma.organizations.findFirst({
      where: { slug, is_active: true },
      select: ORGANIZATION_SELECT,
    });
    if (!organization) throw new ApiError(404, 'المؤسسة غير موجودة أو غير مفعّلة');

    req.organizationId = organization.id;
    req.organization = mapOrganization(organization);
    next();
  } catch (error) {
    next(error);
  }
};

export const resolveAuthenticatedTenant = async (
  req: any,
  res: any,
  next: (error?: unknown) => void
): Promise<void> => {
  try {
    if (!req.user) throw new ApiError(401, 'مطلوب تسجيل الدخول أولاً');

    const requestedOrgId = Array.isArray(req.headers['x-organization-id'])
      ? req.headers['x-organization-id'][0]
      : req.headers['x-organization-id'];
    let organizationId: number | null;

    if (requestedOrgId) {
      organizationId = toPositiveInteger(requestedOrgId);
      const membership = organizationId
        ? await prisma.user_organizations.findFirst({
            where: { user_id: req.user.id, organization_id: organizationId, is_active: true },
            select: { organization_id: true },
          })
        : null;
      if (!membership) throw new ApiError(403, 'لا تملك عضوية في هذه المؤسسة');
      req.organizationId = membership.organization_id;
      next();
      return;
    }

    const defaultOrganizationId = toPositiveInteger(req.user.defaultOrganizationId);
    if (!defaultOrganizationId) throw new ApiError(403, 'لا تنتمي إلى أي مؤسسة افتراضية على المنصة');

    const membership = await prisma.user_organizations.findFirst({
      where: { user_id: req.user.id, organization_id: defaultOrganizationId, is_active: true },
      select: { organization_id: true },
    });
    if (!membership) throw new ApiError(403, 'المؤسسة الافتراضية لم تعد فعّالة لهذا المستخدم');

    req.organizationId = membership.organization_id;
    next();
  } catch (error) {
    next(error);
  }
};

