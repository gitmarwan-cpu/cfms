import type { AppRequest, AppResponse } from '../types/http';

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');
export {};

const login = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json({ success: true, data: result });
});

const register = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await authService.register(req.organizationId, req.body);
  const userData = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const { passwordHash, password_hash, ...userSafe } = userData;
  res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: userSafe });
});

const me = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userData = typeof (req.user as any).toJSON === 'function' ? (req.user as any).toJSON() : req.user;
  const { passwordHash, password_hash, ...userSafe } = userData;
  const organizations = await authService.getMyOrganizations(req.user!.id);
  res.status(200).json({ success: true, data: { ...userSafe, roleCodes: req.user!.roleCodes, permissions: req.user!.permissions, organizations } });
});

/**
 * Self-service password change (account-level, NOT tenant-scoped):
 * authenticate only — no resolveAuthenticatedTenant, because a user must be
 * able to manage their own credential regardless of tenant context.
 * The response never contains password material; request bodies are never
 * logged by this handler.
 */
const changePassword = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const passwordService = require('../services/passwordService');
  await passwordService.changeOwnPassword(
    req.user?.id,
    req.body.currentPassword,
    req.body.newPassword,
    req.organizationId ?? null
  );
  res.status(200).json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
});

module.exports = { login, register, me, changePassword };
