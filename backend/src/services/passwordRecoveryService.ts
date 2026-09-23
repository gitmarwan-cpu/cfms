import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { validatePasswordPolicy } from '../validations/passwordPolicy';
import { recordAuditEvent } from './auditService';

const PASSWORD_SALT_ROUNDS = 10;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const INVALID_RESET_TOKEN_MESSAGE = 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية';

const hashResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token, 'utf8').digest('hex');

const assertPasswordPolicy = (password: string): void => {
  const result = validatePasswordPolicy(password);
  if (!result.valid) throw new ApiError(422, result.message ?? 'كلمة المرور غير صالحة');
};

const assertTokenFormat: (token: unknown) => asserts token is string = (token) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new ApiError(422, INVALID_RESET_TOKEN_MESSAGE);
  }
};

/**
 * Issues a raw token for the future delivery adapter. The HTTP controller
 * deliberately discards this value and never includes it in its response.
 */
export const issuePasswordResetToken = async (email: string): Promise<string | null> => {
  const user = await prisma.users.findUnique({
    where: { email: email.trim() },
    select: { id: true },
  });

  if (!user) return null;

  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

  await prisma.password_reset_tokens.create({
    data: {
      user_id: user.id,
      token_hash: hashResetToken(token),
      expires_at: expiresAt,
      created_at: now,
    },
    select: { id: true },
  });

  return token;
};

export const resetPasswordWithToken = async (token: string, newPassword: string): Promise<void> => {
  assertTokenFormat(token);
  assertPasswordPolicy(newPassword);

  const tokenHash = hashResetToken(token);
  const now = new Date();
  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    const resetToken = await tx.password_reset_tokens.findFirst({
      where: {
        token_hash: tokenHash,
        consumed_at: null,
        expires_at: { gt: now },
      },
      select: { id: true, user_id: true },
    });

    if (!resetToken) throw new ApiError(400, INVALID_RESET_TOKEN_MESSAGE);

    const consumed = await tx.password_reset_tokens.updateMany({
      where: {
        id: resetToken.id,
        token_hash: tokenHash,
        consumed_at: null,
        expires_at: { gt: now },
      },
      data: { consumed_at: now },
    });

    if (consumed.count !== 1) throw new ApiError(400, INVALID_RESET_TOKEN_MESSAGE);

    await tx.users.update({
      where: { id: resetToken.user_id },
      data: { password_hash: passwordHash, write_date: now },
      select: { id: true },
    });

    await recordAuditEvent(tx, {
      organizationId: null,
      actorUserId: null,
      action: 'user.password_reset',
      entityType: 'user',
      entityId: resetToken.user_id,
      metadata: { method: 'email' },
    });
  });
};
