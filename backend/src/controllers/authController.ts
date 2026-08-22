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
  const user = await authService.register(req.organizationId, req.body, req.user?.id);
  const userData = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const { passwordHash, password_hash, ...userSafe } = userData;
  res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: userSafe });
});

const me = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const userData = typeof (req.user as any).toJSON === 'function' ? (req.user as any).toJSON() : req.user;
  const { passwordHash, password_hash, ...userSafe } = userData;
  res.status(200).json({ success: true, data: { ...userSafe, roleCodes: req.user!.roleCodes, permissions: req.user!.permissions } });
});

module.exports = { login, register, me };
