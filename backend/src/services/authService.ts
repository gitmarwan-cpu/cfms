import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { getEffectiveRoleCodes } from './rbacService';
import { recordAuditEvent } from './auditService';
import { validatePasswordPolicy } from '../validations/passwordPolicy';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  roleCode?: string;
  defaultOrganizationId?: number | string | null;
}

export interface UserResponse {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  createDate: Date;
  writeDate: Date;
  createUid: number | null;
  writeUid: number | null;
  createdAt: Date;
  updatedAt: Date;
  primaryOrganizationNodeId: number | null;
  defaultOrganizationId: number | null;
}

const USER_WITH_PASSWORD_SELECT = {
  id: true,
  full_name: true,
  email: true,
  password_hash: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  primary_organization_node_id: true,
  default_organization_id: true,
} as const;

const USER_SAFE_SELECT = {
  id: true,
  full_name: true,
  email: true,
  is_active: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  primary_organization_node_id: true,
  default_organization_id: true,
} as const;

const toSafeInteger = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const mapUser = (user: any): UserResponse => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  isActive: user.is_active,
  createDate: user.create_date,
  writeDate: user.write_date,
  createUid: user.create_uid ?? null,
  writeUid: user.write_uid ?? null,
  createdAt: user.create_date,
  updatedAt: user.write_date,
  primaryOrganizationNodeId: user.primary_organization_node_id ?? null,
  defaultOrganizationId: user.default_organization_id,
});

const recordSuccessfulLoginEvent = async (user: { id: number; default_organization_id: number | null }): Promise<void> => {
  try {
    await recordAuditEvent(prisma, {
      organizationId: user.default_organization_id,
      actorUserId: user.id,
      action: 'auth.login.succeeded',
      entityType: 'user',
      entityId: user.id,
      metadata: { result: 'success' },
    });
  } catch {
    // Authentication must not fail because an audit write is temporarily unavailable.
  }
};

export const generateToken = async (user: { id: number }): Promise<string> => {
  const roleCodes = await getEffectiveRoleCodes(user.id);
  const secret = process.env.JWT_SECRET || 'secret';
  return jwt.sign({ sub: user.id, roles: roleCodes }, secret, {
    expiresIn: '8h',
  });
};

export const login = async (email: string, password: string) => {
  const user = await prisma.users.findUnique({ where: { email }, select: USER_WITH_PASSWORD_SELECT });
  if (!user || !user.is_active) throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

  const token = await generateToken(user);
  const roleCodes = await getEffectiveRoleCodes(user.id);
  await recordSuccessfulLoginEvent({ id: user.id, default_organization_id: user.default_organization_id });
  return { token, user: { ...mapUser(user), roleCodes } };
};

export const register = async (organizationId: string | number, payload: RegisterPayload): Promise<UserResponse> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  if (parsedOrganizationId === null) throw new ApiError(400, 'المؤسسة غير موجودة');

  // Single source of truth for the password policy (shared with the password
  // change/reset endpoints). authValidation.ts mirrors this rule set for
  // HTTP-level validation — keep the two in sync by construction.
  validatePasswordPolicy(payload.password);

  const passwordHash = await bcrypt.hash(payload.password, 10);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.users.findUnique({ where: { email: payload.email }, select: { id: true } });
      if (existing) throw new ApiError(409, 'البريد الإلكتروني مستخدم بالفعل');

      const role = await tx.roles.findFirst({
        where: {
          code: payload.roleCode || 'staff',
          is_active: true,
          OR: [{ organization_id: null }, { organization_id: parsedOrganizationId }],
        },
        select: { id: true },
      });
      if (!role) throw new ApiError(400, 'الدور المحدد غير موجود أو غير مفعّل ضمن مؤسستك');

      const now = new Date();
      const createdUser = await tx.users.create({
        data: {
          full_name: payload.fullName,
          email: payload.email,
          password_hash: passwordHash,
          is_active: true,
          default_organization_id: parsedOrganizationId,
          create_date: now,
          write_date: now,
        },
        select: USER_SAFE_SELECT,
      });

      await tx.user_organizations.create({
        data: {
          user_id: createdUser.id,
          organization_id: parsedOrganizationId,
          is_primary: true,
          is_active: true,
          create_date: now,
          write_date: now,
        },
      });
      await tx.user_roles.create({
        data: {
          user_id: createdUser.id,
          role_id: role.id,
          organization_id: parsedOrganizationId,
          create_date: now,
          write_date: now,
        },
      });

      return createdUser;
    });

    return mapUser(user);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'البريد الإلكتروني مستخدم بالفعل');
    }
    throw error;
  }
};

export interface MembershipOrganization {
  id: number;
  name: string;
  shortName: string | null;
  isPrimary: boolean;
}

/**
 * Active organization memberships for the authenticated user — the payload
 * behind the admin organization switcher. Mirrors the exact acceptance
 * criteria of `resolveAuthenticatedTenant` (membership `is_active: true`), so
 * the UI can only ever offer organizations the backend will actually accept
 * in the `X-Organization-Id` header. Tenant isolation stays server-side.
 */
export const getMyOrganizations = async (userId: number): Promise<MembershipOrganization[]> => {
  const memberships = await prisma.user_organizations.findMany({
    where: { user_id: userId, is_active: true },
    select: {
      is_primary: true,
      organizations: { select: { id: true, legal_name: true, short_name: true } },
    },
    orderBy: [{ is_primary: 'desc' }, { organization_id: 'asc' }],
  });

  return memberships.map((membership) => ({
    id: membership.organizations.id,
    name: membership.organizations.legal_name,
    shortName: membership.organizations.short_name,
    isPrimary: membership.is_primary,
  }));
};

// ─── Password Lifecycle (Phase 3) ─────────────────────────────────────────────

/** Audit org: the session tenant when available, else the user's default org
 * (mirrors the recordSuccessfulLoginEvent precedence). */
const resolveAuditOrganizationId = (user: {
  organizationId?: number | null;
  default_organization_id: number | null;
}): number | null =>
  typeof user.organizationId === 'number' ? user.organizationId : user.default_organization_id;

/**
 * Self-service password change (POST /auth/change-password).
 *
 * Account-level operation — NOT tenant-scoped (authenticate only). The audit
 * event uses the caller's organization context when available, otherwise their
 * default organization, mirroring recordSuccessfulLoginEvent.
 *
 * The shared password policy (passwordPolicy.ts) is enforced — the exact same
 * rule set as registration. The generic auth-failure message is used for both
 * "account not found" and "wrong current password" so the endpoint never
 * reveals whether an account exists. No password material is ever logged,
 * returned, or placed in audit metadata.
 */
export const changeUserPassword = async (
  actorUserId: number | null | undefined,
  currentPassword: unknown,
  newPassword: unknown
): Promise<void> => {
  const parsedUserId = toSafeInteger(actorUserId ?? null);
  if (parsedUserId === null) throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    throw new ApiError(422, 'كلمة المرور الحالية مطلوبة');
  }

  const user = await prisma.users.findUnique({
    where: { id: parsedUserId },
    select: { id: true, password_hash: true, is_active: true, default_organization_id: true },
  });
  if (!user || !user.is_active) throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

  const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!currentPasswordMatches) throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

  if (typeof newPassword !== 'string' || newPassword.length === 0) {
    throw new ApiError(422, 'كلمة المرور الجديدة مطلوبة');
  }

  validatePasswordPolicy(newPassword);
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  const organizationId = resolveAuditOrganizationId(user);
  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: parsedUserId },
      data: { password_hash: newPasswordHash, write_date: new Date() },
    });
    await recordAuditEvent(tx, {
      organizationId,
      actorUserId: parsedUserId,
      action: 'user.password_changed',
      entityType: 'user',
      entityId: parsedUserId,
      metadata: { method: 'self' },
    });
  });
};

/**
 * Admin-issued password reset (POST /users/:userId/reset-password).
 *
 * NOTE (accepted for Phase 3): resetting a password does NOT invalidate the
 * target user's existing sessions — JWTs are stateless with an 8-hour expiry
 * window, so previously-issued tokens keep working until they expire. No
 * token_version column or session-invalidation flow was approved for this
 * phase; do not mistake this for an oversight.
 */
export const adminResetUserPassword = async (
  organizationId: number | null | undefined,
  actorUserId: number | null | undefined,
  targetUserId: unknown,
  newPassword: unknown
): Promise<void> => {
  const parsedOrganizationId = toSafeInteger(organizationId ?? null);
  if (parsedOrganizationId === null) throw new ApiError(400, 'المؤسسة غير موجودة');

  const parsedTargetUserId = toSafeInteger(
    typeof targetUserId === 'number' ? targetUserId : String(targetUserId ?? '')
  );
  if (parsedTargetUserId === null) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  // The target must hold an ACTIVE membership in the CALLER's organization —
  // 404 (never 403) so the existence of the user in another tenant is not leaked.
  const membership = await prisma.user_organizations.findFirst({
    where: {
      user_id: parsedTargetUserId,
      organization_id: parsedOrganizationId,
      is_active: true,
    },
    select: { id: true },
  });
  if (!membership) throw new ApiError(404, 'المستخدم غير موجود');

  const targetUser = await prisma.users.findUnique({
    where: { id: parsedTargetUserId },
    select: { id: true },
  });
  if (!targetUser) throw new ApiError(404, 'المستخدم غير موجود');

  if (typeof newPassword !== 'string' || newPassword.length === 0) {
    throw new ApiError(422, 'كلمة المرور الجديدة مطلوبة');
  }

  validatePasswordPolicy(newPassword);
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: parsedTargetUserId },
      data: { password_hash: newPasswordHash, write_date: new Date() },
    });
    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: actorUserId ?? null,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: parsedTargetUserId,
      metadata: { method: 'admin', byUserId: actorUserId ?? null },
    });
  });
};
