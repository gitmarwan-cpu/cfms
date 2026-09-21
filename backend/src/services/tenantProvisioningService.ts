import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';
import {
  parseNullableLocationId,
  validateLocationCombination,
  type CreateOrganizationPayload,
} from './organizationService';
import { transitionTenantLifecycle } from './tenantLifecycleService';
import { validatePasswordPolicy } from '../validations/passwordPolicy';

const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INITIAL_ADMIN_ROLE_CODE = 'admin';

type DbClient = Prisma.TransactionClient;

export interface InitialTenantAdminPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface TenantProvisioningPayload extends CreateOrganizationPayload {
  initialAdmin: InitialTenantAdminPayload;
}

const toSafeInteger = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizePayload = async (payload: TenantProvisioningPayload) => {
  const legalName = payload.legalName?.trim() ?? '';
  if (legalName.length < 2 || legalName.length > 200) {
    throw new ApiError(422, 'اسم المؤسسة مطلوب (2-200 حرف)');
  }

  const slug = payload.slug?.trim().toLowerCase() ?? '';
  if (!ORGANIZATION_SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 80) {
    throw new ApiError(422, 'معرّف المؤسسة (slug) غير صالح: أحرف لاتينية صغيرة وأرقام وشرطات فقط (3-80)');
  }

  const initialAdmin = payload.initialAdmin;
  const fullName = initialAdmin?.fullName?.trim() ?? '';
  const email = initialAdmin?.email?.trim().toLowerCase() ?? '';
  if (fullName.length < 2 || fullName.length > 150) {
    throw new ApiError(422, 'اسم مدير المستأجر مطلوب (2-150 حرف)');
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(422, 'البريد الإلكتروني لمدير المستأجر غير صالح');
  }
  if (typeof initialAdmin.password !== 'string') {
    throw new ApiError(422, 'كلمة مرور مدير المستأجر مطلوبة');
  }
  const passwordResult = validatePasswordPolicy(initialAdmin.password);
  if (!passwordResult.valid) throw new ApiError(422, passwordResult.message ?? 'كلمة المرور غير صالحة');

  const countryId = parseNullableLocationId(payload.countryId, 'الدولة');
  const governorateId = parseNullableLocationId(payload.governorateId, 'المحافظة');
  const districtId = parseNullableLocationId(payload.districtId, 'المديرية');
  await validateLocationCombination(countryId, governorateId, districtId);

  const existingRoot = await prisma.organizations.findFirst({
    where: { slug, parent_id: null },
    select: { id: true },
  });
  if (existingRoot) throw new ApiError(409, 'معرّف المؤسسة (slug) مستخدم مسبقاً');

  return {
    legalName,
    slug,
    shortName: payload.shortName?.trim() || null,
    description: payload.description?.trim() || null,
    countryId,
    governorateId,
    districtId,
    email: payload.email?.trim() || null,
    website: payload.website?.trim() || null,
    initialAdmin: { fullName, email, password: initialAdmin.password },
  };
};

const createOrganizationAndDefaults = async (
  tx: DbClient,
  payload: Awaited<ReturnType<typeof normalizePayload>>,
  actorUserId: number
) => {
  const now = new Date();
  const organization = await tx.organizations.create({
    data: {
      legal_name: payload.legalName,
      short_name: payload.shortName,
      description: payload.description,
      slug: payload.slug,
      country: 'Yemen',
      country_id: payload.countryId,
      governorate_id: payload.governorateId,
      district_id: payload.districtId,
      email: payload.email,
      website: payload.website,
      default_language: 'ar',
      timezone: 'Asia/Aden',
      date_format: 'DD/MM/YYYY',
      anonymous_complaints_policy: 'allowed',
      notification_settings: {},
      is_active: true,
      lifecycle_status: 'provisioning',
      status_changed_at: now,
      status_changed_by_user_id: actorUserId,
      status_reason: 'Provisioning started',
      create_date: now,
      write_date: now,
      create_uid: actorUserId,
      write_uid: actorUserId,
    },
  });

  // The tenant root is the organization row itself. These defaults make the
  // existing hierarchy immediately usable without creating a second root row.
  const branchType = await tx.org_unit_types.create({
    data: {
      organization_id: organization.id,
      code: 'branch_sector',
      name_ar: 'فرع / قطاع',
      name_en: 'Branch / Sector',
      hierarchy_level: 1,
      is_active: true,
      create_date: now,
      write_date: now,
      create_uid: actorUserId,
      write_uid: actorUserId,
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
      create_uid: actorUserId,
      write_uid: actorUserId,
    },
  });

  return { organization, now };
};

export const provisionTenant = async (payload: TenantProvisioningPayload, actorUserId: number) => {
  const parsedActorUserId = toSafeInteger(actorUserId);
  if (!parsedActorUserId) throw new ApiError(403, 'مستخدم المنصة غير صالح');

  const normalized = await normalizePayload(payload);
  const passwordHash = await bcrypt.hash(normalized.initialAdmin.password, 10);

  try {
    return await prisma.$transaction(async (tx) => {
      const { organization, now } = await createOrganizationAndDefaults(tx, normalized, parsedActorUserId);

      const tenantAdminRole = await tx.roles.findFirst({
        where: {
          code: INITIAL_ADMIN_ROLE_CODE,
          organization_id: null,
          scope: 'tenant',
          is_system: true,
          is_active: true,
        },
        select: { id: true, code: true, scope: true, organization_id: true },
      });
      if (!tenantAdminRole) throw new ApiError(500, 'دور مدير المستأجر غير مهيأ في المنصة');

      const initialAdmin = await tx.users.create({
        data: {
          full_name: normalized.initialAdmin.fullName,
          email: normalized.initialAdmin.email,
          password_hash: passwordHash,
          is_active: true,
          default_organization_id: organization.id,
          create_date: now,
          write_date: now,
          create_uid: parsedActorUserId,
          write_uid: parsedActorUserId,
        },
        select: { id: true, full_name: true, email: true, is_active: true },
      });

      const membership = await tx.user_organizations.create({
        data: {
          user_id: initialAdmin.id,
          organization_id: organization.id,
          is_primary: true,
          is_active: true,
          create_date: now,
          write_date: now,
          create_uid: parsedActorUserId,
          write_uid: parsedActorUserId,
        },
      });
      await recordAuditEvent(tx, {
        organizationId: organization.id,
        actorUserId: parsedActorUserId,
        action: 'membership.granted',
        entityType: 'user_organization',
        entityId: membership.id,
        metadata: { userId: initialAdmin.id, reactivated: false, isPrimary: true },
      });

      const roleAssignment = await tx.user_roles.create({
        data: {
          user_id: initialAdmin.id,
          role_id: tenantAdminRole.id,
          organization_id: organization.id,
          organization_node_id: null,
          create_date: now,
          write_date: now,
          create_uid: parsedActorUserId,
          write_uid: parsedActorUserId,
        },
      });
      await recordAuditEvent(tx, {
        organizationId: organization.id,
        actorUserId: parsedActorUserId,
        action: 'user_role.assigned',
        entityType: 'user_role',
        entityId: roleAssignment.id,
        metadata: { userId: initialAdmin.id, roleId: tenantAdminRole.id, roleCode: tenantAdminRole.code, organizationNodeId: null },
      });

      await recordAuditEvent(tx, {
        organizationId: organization.id,
        actorUserId: parsedActorUserId,
        action: 'organization.created',
        entityType: 'organization',
        entityId: organization.id,
        metadata: { slug: organization.slug, lifecycleStatus: 'provisioning' },
      });

      const activeOrganization = await transitionTenantLifecycle(
        organization.id,
        'active',
        parsedActorUserId,
        'Provisioning completed',
        tx
      );

      return {
        organization: {
          id: activeOrganization.id,
          legalName: organization.legal_name,
          slug: organization.slug,
          lifecycleStatus: activeOrganization.lifecycle_status,
          statusChangedAt: activeOrganization.status_changed_at,
          statusChangedByUserId: activeOrganization.status_changed_by_user_id,
          statusReason: activeOrganization.status_reason,
        },
        rootOrganizationNode: {
          id: organization.id,
          parentId: organization.parent_id,
          rootOrganizationId: organization.root_organization_id,
          orgUnitTypeId: organization.org_unit_type_id,
        },
        initialAdmin: {
          id: initialAdmin.id,
          fullName: initialAdmin.full_name,
          email: initialAdmin.email,
          isActive: initialAdmin.is_active,
        },
        membership: {
          id: membership.id,
          userId: membership.user_id,
          organizationId: membership.organization_id,
          isPrimary: membership.is_primary,
          isActive: membership.is_active,
        },
        tenantRole: {
          id: tenantAdminRole.id,
          code: tenantAdminRole.code,
          scope: tenantAdminRole.scope,
          organizationId: tenantAdminRole.organization_id,
          assignmentId: roleAssignment.id,
        },
      };
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'البريد الإلكتروني أو معرّف المؤسسة مستخدم مسبقاً');
    }
    throw error;
  }
};
