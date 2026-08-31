import bcrypt from 'bcryptjs';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { validatePasswordPolicy } from '../validations/passwordPolicy';
import { recordAuditEvent } from './auditService';

/**
 * Password lifecycle service (Phase 3).
 *
 * Single authoritative implementation for:
 *   - self-service password change  (POST /auth/change-password)
 *   - admin-issued password reset   (POST /users/:userId/reset-password)
 *
 * Rules:
 *   - The shared policy (validations/passwordPolicy.ts) is the ONLY rule set.
 *   - Password material (plaintext or hash) is never returned, logged, or
 *     written to audit metadata.
 *   - Every mutation writes its audit event inside the same Prisma
 *     transaction (recordAuditEvent receives the tx client).
 *   - Wrong-current-password responses are identical to any other auth
 *     failure — the existence of an account is never disclosed.
 */

const AUTH_FAILURE_MESSAGE = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
const USER_NOT_FOUND = 'المستخدم غير موجود';
const PASSWORD_SALT_ROUNDS = 10;

const enforcePolicy = (newPassword: string): void => {
  const result = validatePasswordPolicy(newPassword);
  if (!result.valid) throw new ApiError(422, result.message ?? 'كلمة المرور غير صالحة');
};

/**
 * Self-service password change (account-level, not tenant-scoped).
 *
 * `organizationId` is the optional tenant context of the caller (passed by the
 * controller from req.organizationId when available); the audit event falls
 * back to the user's default organization, mirroring
 * `recordSuccessfulLoginEvent` in authService.
 */
export const changeOwnPassword = async (
  userId: unknown,
  currentPassword: string,
  newPassword: string,
  organizationId?: number | null
): Promise<void> => {
  const parsedUserId = typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  if (!parsedUserId) throw new ApiError(401, AUTH_FAILURE_MESSAGE);

  enforcePolicy(newPassword);

  const user = await prisma.users.findUnique({
    where: { id: parsedUserId },
    select: { id: true, is_active: true, password_hash: true, default_organization_id: true },
  });
  // Same generic failure whether the account is missing or inactive —
  // never leak which one it is.
  if (!user || !user.is_active) throw new ApiError(401, AUTH_FAILURE_MESSAGE);

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) throw new ApiError(401, AUTH_FAILURE_MESSAGE);

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: user.id },
      data: { password_hash: passwordHash, write_date: new Date() },
      select: { id: true },
    });

    await recordAuditEvent(tx, {
      organizationId: organizationId ?? user.default_organization_id,
      actorUserId: user.id,
      action: 'user.password_changed',
      entityType: 'user',
      entityId: user.id,
      metadata: { method: 'self' },
    });
  });
};

/**
 * Admin-issued password reset within the caller's tenant.
 *
 * The target user must hold an ACTIVE membership in `organizationId`; any
 * other user (including one existing only in another tenant) yields 404 so
 * cross-tenant account existence is never leaked.
 *
 * NOTE (accepted design decision, Phase 3 audit): existing sessions/tokens are
 * NOT invalidated after a reset — the project uses stateless 8h JWTs without a
 * token_version column, so a reset takes effect for new logins immediately and
 * old tokens simply expire within the accepted 8h window. This is deliberate,
 * not an oversight. Do not "fix" it without an architectural decision.
 */
export const adminResetUserPassword = async (
  organizationId: unknown,
  actorUserId: number | null | undefined,
  targetUserId: unknown,
  newPassword: string
): Promise<void> => {
  const parsedOrganizationId =
    typeof organizationId === 'number' && Number.isSafeInteger(organizationId) && organizationId > 0
      ? organizationId
      : null;
  if (!parsedOrganizationId) throw new ApiError(400, 'المؤسسة غير موجودة');

  const parsedTargetUserId =
    typeof targetUserId === 'number' && Number.isSafeInteger(targetUserId) && targetUserId > 0
      ? targetUserId
      : null;
  if (!parsedTargetUserId) throw new ApiError(400, 'معرّف المستخدم غير صالح');

  enforcePolicy(newPassword);

  const membership = await prisma.user_organizations.findFirst({
    where: {
      user_id: parsedTargetUserId,
      organization_id: parsedOrganizationId,
      is_active: true,
    },
    select: { id: true },
  });
  // 404 — not 403/400 — so the caller cannot discover whether the user exists
  // in a different tenant.
  if (!membership) throw new ApiError(404, USER_NOT_FOUND);

  const target = await prisma.users.findUnique({
    where: { id: parsedTargetUserId },
    select: { id: true },
  });
  if (!target) throw new ApiError(404, USER_NOT_FOUND);

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: target.id },
      data: { password_hash: passwordHash, write_date: new Date() },
      select: { id: true },
    });

    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: actorUserId ?? null,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: target.id,
      metadata: { method: 'admin', byUserId: actorUserId ?? null },
    });
  });
};
