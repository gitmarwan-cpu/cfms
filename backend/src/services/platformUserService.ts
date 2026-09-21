import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';
import { countActiveAdmins } from './membershipService';
import { validatePasswordPolicy } from '../validations/passwordPolicy';

export interface PlatformUserListFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
  isActive?: string;
}

export interface PlatformUserCreatePayload {
  fullName: string;
  email: string;
  password: string;
}

export interface MembershipUserOptionsFilters {
  page?: string | number;
  limit?: string | number;
  search?: string;
}

const USER_FIELDS = {
  id: true,
  full_name: true,
  email: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  default_organization_id: true,
  primary_organization_node_id: true,
} as const;

const MEMBERSHIP_USER_OPTION_FIELDS = {
  id: true,
  full_name: true,
  email: true,
} as const;

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const mapUser = (user: any) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  isActive: user.is_active,
  createDate: user.create_date,
  writeDate: user.write_date,
  createUid: user.create_uid ?? null,
  writeUid: user.write_uid ?? null,
  defaultOrganizationId: user.default_organization_id ?? null,
  primaryOrganizationNodeId: user.primary_organization_node_id ?? null,
});

const normalizeCreatePayload = (payload: PlatformUserCreatePayload) => {
  const fullName = payload.fullName?.trim() ?? '';
  const email = payload.email?.trim().toLowerCase() ?? '';
  if (fullName.length < 2 || fullName.length > 150) throw new ApiError(422, 'الاسم الكامل يجب أن يكون بين 2 و 150 حرفاً');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(422, 'البريد الإلكتروني غير صالح');
  if (typeof payload.password !== 'string') throw new ApiError(422, 'كلمة المرور مطلوبة');
  const passwordResult = validatePasswordPolicy(payload.password);
  if (!passwordResult.valid) throw new ApiError(422, passwordResult.message ?? 'كلمة المرور غير صالحة');
  return { fullName, email, password: payload.password };
};

export const listUsers = async (filters: PlatformUserListFilters = {}) => {
  const page = Math.max(1, Number.parseInt(String(filters.page || ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit || ''), 10) || 20));
  const where: Prisma.usersWhereInput = {};

  if (filters.isActive === 'true') where.is_active = true;
  if (filters.isActive === 'false') where.is_active = false;
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { full_name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.users.findMany({
      where,
      select: {
        ...USER_FIELDS,
        user_organizations: { select: { organization_id: true, is_active: true } },
      },
      orderBy: { create_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.users.count({ where }),
  ]);

  return {
    data: rows.map((user) => ({
      ...mapUser(user),
      membershipCount: user.user_organizations.length,
      activeMembershipCount: user.user_organizations.filter((membership) => membership.is_active).length,
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const listMembershipUserOptions = async (filters: MembershipUserOptionsFilters = {}) => {
  const page = Math.max(1, Number.parseInt(String(filters.page || ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit || ''), 10) || 20));
  const where: Prisma.usersWhereInput = {};

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { full_name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.users.findMany({
      where,
      select: MEMBERSHIP_USER_OPTION_FIELDS,
      orderBy: { create_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.users.count({ where }),
  ]);

  return {
    data: rows.map((user) => ({ id: user.id, fullName: user.full_name, email: user.email })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export interface PlatformUserDetailOptions {
  includeMembershipDetails?: boolean;
}

export const getUserById = async (
  userId: unknown,
  options: PlatformUserDetailOptions = {}
) => {
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  const user = await prisma.users.findUnique({ where: { id: parsedUserId }, select: USER_FIELDS });
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');

  if (!options.includeMembershipDetails) {
    return {
      ...mapUser(user),
      memberships: [],
      tenantRoles: [],
      platformRoles: [],
    };
  }

  const [memberships, roles, platformRoles] = await Promise.all([
    prisma.user_organizations.findMany({
      where: { user_id: parsedUserId },
      orderBy: { organization_id: 'asc' },
      select: {
        id: true,
        organization_id: true,
        is_primary: true,
        is_active: true,
        organizations: { select: { id: true, legal_name: true, slug: true, lifecycle_status: true } },
      },
    }),
    prisma.user_roles.findMany({
      where: { user_id: parsedUserId, roles: { scope: 'tenant' } },
      select: {
        id: true,
        role_id: true,
        organization_id: true,
        organization_node_id: true,
        roles: { select: { code: true, name_ar: true, name_en: true, scope: true } },
      },
      orderBy: { organization_id: 'asc' },
    }),
    prisma.user_platform_roles.findMany({
      where: { user_id: parsedUserId, roles: { scope: 'platform' } },
      select: { role_id: true, roles: { select: { code: true, name_ar: true, name_en: true, scope: true } } },
    }),
  ]);

  return {
    ...mapUser(user),
    memberships: memberships.map((membership) => ({
      id: membership.id,
      organizationId: membership.organization_id,
      isPrimary: membership.is_primary,
      isActive: membership.is_active,
      organization: membership.organizations,
    })),
    tenantRoles: roles.map((assignment) => ({
      id: assignment.id,
      roleId: assignment.role_id,
      organizationId: assignment.organization_id,
      organizationNodeId: assignment.organization_node_id,
      role: assignment.roles,
    })),
    platformRoles: platformRoles.map((assignment) => ({ roleId: assignment.role_id, role: assignment.roles })),
  };
};

export const createUser = async (payload: PlatformUserCreatePayload, actorUserId: number) => {
  const parsedActorUserId = toPositiveInteger(actorUserId);
  if (!parsedActorUserId) throw new ApiError(403, 'مستخدم المنصة غير صالح');
  const normalized = normalizeCreatePayload(payload);
  const passwordHash = await bcrypt.hash(normalized.password, 10);
  const now = new Date();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          full_name: normalized.fullName,
          email: normalized.email,
          password_hash: passwordHash,
          is_active: true,
          create_date: now,
          write_date: now,
          create_uid: parsedActorUserId,
          write_uid: parsedActorUserId,
        },
        select: USER_FIELDS,
      });
      await recordAuditEvent(tx, {
        organizationId: null,
        actorUserId: parsedActorUserId,
        action: 'user.created',
        entityType: 'user',
        entityId: created.id,
        metadata: { source: 'platform' },
      });
      return created;
    });
    return mapUser(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'البريد الإلكتروني مستخدم بالفعل');
    }
    throw error;
  }
};

const assertUserId = (userId: unknown): number => {
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');
  return parsedUserId;
};

export const deactivateUser = async (userId: unknown, actorUserId: number) => {
  const parsedUserId = assertUserId(userId);
  const parsedActorUserId = assertUserId(actorUserId);
  if (parsedUserId === parsedActorUserId) throw new ApiError(400, 'لا يمكنك إلغاء تفعيل حسابك بنفسك');

  return prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({ where: { id: parsedUserId }, select: { id: true, is_active: true } });
    if (!user) throw new ApiError(404, 'المستخدم غير موجود');
    if (!user.is_active) throw new ApiError(400, 'المستخدم غير مفعّل أصلاً');

    const activeMemberships = await tx.user_organizations.findMany({
      where: { user_id: parsedUserId, is_active: true },
      select: { organization_id: true },
    });
    const adminAssignments = await tx.user_roles.findMany({
      where: {
        user_id: parsedUserId,
        organization_id: { in: activeMemberships.map((membership) => membership.organization_id) },
        roles: { code: 'admin', scope: 'tenant' },
      },
      select: { organization_id: true },
    });
    for (const organizationId of new Set(adminAssignments.map((assignment) => assignment.organization_id))) {
      if (await countActiveAdmins(tx, organizationId) <= 1) {
        throw new ApiError(400, 'لا يمكن إلغاء تفعيل المستخدم لأنه آخر مدير نشط في إحدى المؤسسات');
      }
    }

    const updated = await tx.users.update({
      where: { id: parsedUserId },
      data: { is_active: false, write_date: new Date(), write_uid: parsedActorUserId },
      select: USER_FIELDS,
    });
    await recordAuditEvent(tx, {
      organizationId: null,
      actorUserId: parsedActorUserId,
      action: 'user.deactivated',
      entityType: 'user',
      entityId: parsedUserId,
      metadata: { source: 'platform' },
    });
    return mapUser(updated);
  });
};

export const activateUser = async (userId: unknown, actorUserId: number) => {
  const parsedUserId = assertUserId(userId);
  const parsedActorUserId = assertUserId(actorUserId);

  return prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({ where: { id: parsedUserId }, select: { id: true, is_active: true } });
    if (!user) throw new ApiError(404, 'المستخدم غير موجود');
    if (user.is_active) throw new ApiError(400, 'المستخدم مفعّل بالفعل');

    const updated = await tx.users.update({
      where: { id: parsedUserId },
      data: { is_active: true, write_date: new Date(), write_uid: parsedActorUserId },
      select: USER_FIELDS,
    });
    await recordAuditEvent(tx, {
      organizationId: null,
      actorUserId: parsedActorUserId,
      action: 'user.activated',
      entityType: 'user',
      entityId: parsedUserId,
      metadata: { source: 'platform' },
    });
    return mapUser(updated);
  });
};
