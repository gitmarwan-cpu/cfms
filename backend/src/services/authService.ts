import { Prisma } from '@prisma/client';

// The existing dependencies do not ship declarations in this repository.
// Keep the runtime imports CommonJS-compatible until the dependency retirement phase.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { getEffectiveRoleCodes } from './rbacService';
import { recordAuditEvent } from './auditService';

export interface UserResponse {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  orgUnitId: number | null;
  defaultOrganizationId: number | null;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  roleCode?: string;
  orgUnitId?: string | number | null;
}

const USER_WITH_PASSWORD_SELECT = {
  id: true,
  full_name: true,
  email: true,
  password_hash: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  org_unit_id: true,
  default_organization_id: true,
} as const;

const USER_SAFE_SELECT = {
  id: true,
  full_name: true,
  email: true,
  is_active: true,
  created_at: true,
  updated_at: true,
  org_unit_id: true,
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
  createdAt: user.created_at,
  updatedAt: user.updated_at,
  orgUnitId: user.org_unit_id,
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
  return jwt.sign({ sub: user.id, roles: roleCodes }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
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
  const parsedOrgUnitId = toSafeInteger(payload.orgUnitId);
  if (parsedOrganizationId === null) throw new ApiError(400, 'المؤسسة غير موجودة');

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
          org_unit_id: parsedOrgUnitId,
          default_organization_id: parsedOrganizationId,
          created_at: now,
          updated_at: now,
        },
        select: USER_SAFE_SELECT,
      });

      await tx.user_organizations.create({
        data: {
          user_id: createdUser.id,
          organization_id: parsedOrganizationId,
          is_primary: true,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      });
      await tx.user_roles.create({
        data: {
          user_id: createdUser.id,
          role_id: role.id,
          organization_id: parsedOrganizationId,
          org_unit_id: parsedOrgUnitId,
          created_at: now,
          updated_at: now,
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
