import type { AppRequest, AppResponse } from '../types/http';

import catchAsync from '../utils/catchAsync';
import * as authService from '../services/authService';
import * as passwordService from '../services/passwordService';
import * as passwordRecoveryService from '../services/passwordRecoveryService';
import * as emailService from '../services/emailService';
const login = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json({ success: true, data: result });
});

const register = catchAsync(async (req: AppRequest, res: AppResponse) => {
  // Pass trusted server-side permissions so register() can validate creator node scope.
  const creatorPermissions = req.user?.permissions ?? [];
  const user = await authService.register(req.organizationId!, req.body, creatorPermissions);
  const userSafe = user;
  res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: userSafe });
});

const me = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userData = typeof (req.user as any).toJSON === 'function' ? (req.user as any).toJSON() : req.user;
  const { passwordHash, password_hash, ...userSafe } = userData;
  const organizations = await authService.getMyOrganizations(req.user!.id);
  res.status(200).json({
    success: true,
    data: {
      ...userSafe,
      roleCodes: req.user!.roleCodes,
      permissions: req.user!.permissions,
      platformRoleCodes: req.user!.platformRoleCodes,
      platformPermissions: req.user!.platformPermissions,
      organizations,
    },
  });
});

/**
 * Self-service password change (account-level, NOT tenant-scoped):
 * authenticate only — no resolveAuthenticatedTenant, because a user must be
 * able to manage their own credential regardless of tenant context.
 * The response never contains password material; request bodies are never
 * logged by this handler.
 */
const changePassword = catchAsync(async (req: AppRequest, res: AppResponse) => {
  await passwordService.changeOwnPassword(
    req.user?.id,
    req.body.currentPassword,
    req.body.newPassword,
    req.organizationId ?? null
  );
  res.status(200).json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
});

const DEFAULT_FORGOT_PASSWORD_DELAY_MS = 750;
const MAX_FORGOT_PASSWORD_DELAY_MS = 5000;

/**
 * Resolves and strictly validates the minimum response-time floor for password recovery.
 *
 * Rules:
 * - When unset: defaults to 0 ms in test environment (`NODE_ENV === 'test'`),
 *   and 750 ms in production / development.
 * - Strict format validation: accepts only non-negative integer digit strings (`^\d+$`).
 *   Rejects malformed values (e.g., '750abc', decimals, negatives, non-numeric).
 * - Safe fallback: Malformed configuration in production falls back to the safe default
 *   (750 ms) rather than silently disabling the timing floor (0 ms).
 * - Upper bound: Clamped to MAX_FORGOT_PASSWORD_DELAY_MS (5000 ms) to prevent accidental
 *   or excessive request hanging and gateway timeouts.
 */
export const resolveForgotPasswordMinDelayMs = (
  envValue = process.env.FORGOT_PASSWORD_MIN_DELAY_MS,
  nodeEnv = process.env.NODE_ENV
): number => {
  const isTest = nodeEnv === 'test';
  const defaultDelay = isTest ? 0 : DEFAULT_FORGOT_PASSWORD_DELAY_MS;

  if (envValue === undefined || envValue.trim() === '') {
    return defaultDelay;
  }

  const trimmed = envValue.trim();
  if (!/^\d+$/.test(trimmed)) {
    if (!isTest) {
      console.warn('[Auth] Invalid FORGOT_PASSWORD_MIN_DELAY_MS configuration; falling back to default floor');
    }
    return defaultDelay;
  }

  const parsed = Number(trimmed);
  if (parsed > MAX_FORGOT_PASSWORD_DELAY_MS) {
    if (!isTest) {
      console.warn(`[Auth] FORGOT_PASSWORD_MIN_DELAY_MS exceeds maximum allowed limit (${MAX_FORGOT_PASSWORD_DELAY_MS}ms); clamping to upper bound`);
    }
    return MAX_FORGOT_PASSWORD_DELAY_MS;
  }

  return parsed;
};

/**
 * Determines whether development-only reset link exposure is explicitly enabled.
 *
 * Security rules:
 * - In production (NODE_ENV === 'production'), strictly returns false regardless of any flags.
 * - In non-production, requires explicit enablement via ALLOW_DEV_RESET_LINK='true' | '1'.
 */
export const isDevResetLinkEnabled = (
  envValue = process.env.ALLOW_DEV_RESET_LINK,
  nodeEnv = process.env.NODE_ENV
): boolean => {
  if (nodeEnv === 'production') {
    return false;
  }
  const normalized = envValue?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
};

/**
 * Request password recovery instructions:
 * Mitigates timing-based account enumeration attacks by enforcing a strictly validated,
 * bounded minimum response-time floor (`FORGOT_PASSWORD_MIN_DELAY_MS`, default 750ms; 0ms in test).
 *
 * NOTE: This establishes a conservative minimum baseline duration to blunt fast-path
 * enumeration (where non-existent accounts resolve in milliseconds). It does NOT make
 * response times mathematically constant, as network variability, TLS negotiation, and
 * SMTP dispatch latency may naturally exceed this floor.
 *
 * Security rules:
 * - Emits the exact same generic HTTP 200 payload regardless of account existence.
 * - Traps token-issuance and email-delivery exceptions safely within the flow, preventing
 *   internal database or provider errors from leaking account existence via HTTP 500.
 * - Preserves upstream input-validation (422) and rate-limiting (429) middleware behaviors.
 * - Suppresses all raw errors, recipient addresses, tokens, SQL queries, and credentials from logs.
 * - Token expiry, hashing, and consumption lifecycles remain completely unaffected.
 * - Safe development delivery: When explicitly enabled (ALLOW_DEV_RESET_LINK='true' in non-production)
 *   and email delivery is unavailable, provides a resetUrl constructed from trusted FRONTEND_URL.
 *   Production NEVER exposes reset tokens or URLs under any circumstance.
 */
const forgotPassword = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const startTime = Date.now();
  const minFloorMs = resolveForgotPasswordMinDelayMs();

  let devResetUrl: string | undefined;

  try {
    try {
      const token = await passwordRecoveryService.issuePasswordResetToken(req.body.email);
      let emailDelivered = false;

      if (token) {
        try {
          const dispatchResult = await emailService.sendPasswordResetEmail(req.body.email, token);
          emailDelivered = dispatchResult?.accepted === true;
        } catch {
          // Record delivery failure safely without leaking internal failure, recipient email, tokens, or credentials
          console.error('[Auth] Password reset email dispatch failed');
        }

        // Safe development-only delivery: expose reset URL only if explicitly enabled
        // in development/test and email delivery is unavailable. Never in production.
        if (!emailDelivered && isDevResetLinkEnabled()) {
          try {
            const frontendUrl = emailService.validateFrontendUrl();
            devResetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
          } catch {
            // Frontend URL resolution failure must not compromise request safety
          }
        }
      }
    } catch {
      // Record token issuance failure safely without leaking internal failure, recipient email, or database errors
      console.error('[Auth] Password reset token issuance failed');
    }
  } finally {
    const elapsed = Date.now() - startTime;
    const remaining = minFloorMs - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  const responsePayload: { success: boolean; message: string; resetUrl?: string; devResetUrl?: string } = {
    success: true,
    message: 'إذا كان البريد الإلكتروني مرتبطاً بحساب، فسيتم إرسال تعليمات إعادة التعيين إليه',
  };

  if (devResetUrl) {
    responsePayload.resetUrl = devResetUrl;
    responsePayload.devResetUrl = devResetUrl;
  }

  res.status(200).json(responsePayload);
});


const resetPassword = catchAsync(async (req: AppRequest, res: AppResponse) => {
  await passwordRecoveryService.resetPasswordWithToken(req.body.token, req.body.newPassword);
  res.status(200).json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
});

export {
  login,
  register,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  DEFAULT_FORGOT_PASSWORD_DELAY_MS,
  MAX_FORGOT_PASSWORD_DELAY_MS,
};