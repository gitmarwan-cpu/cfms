import type { AppRequest, AppResponse } from '../types/http';

import catchAsync from '../utils/catchAsync';
import * as authService from '../services/authService';
import * as passwordService from '../services/passwordService';
const login = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json({ success: true, data: result });
});

const register = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await authService.register(req.organizationId!, req.body);
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

export { login, register, me, changePassword };
