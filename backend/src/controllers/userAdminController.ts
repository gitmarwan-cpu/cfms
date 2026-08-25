import type { AppRequest, AppResponse } from '../types/http';

const catchAsync = require('../utils/catchAsync');
const userAdminService = require('../services/userAdminService');
export {};

const listUsers = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await userAdminService.listUsers(req.organizationId, {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    isActive: req.query.isActive,
  });
  res.status(200).json({ success: true, ...result });
});

const getUserById = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await userAdminService.getUserById(req.organizationId, req.params.userId);
  res.status(200).json({ success: true, data: user });
});

const updateUser = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await userAdminService.updateUser(
    req.organizationId,
    req.params.userId,
    {
      fullName: req.body.fullName,
      email: req.body.email,
      primaryOrganizationNodeId: req.body.primaryOrganizationNodeId,
    },
    req.user?.id ?? null
  );
  res.status(200).json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح', data: user });
});

const deactivateUser = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await userAdminService.deactivateUser(
    req.organizationId,
    req.params.userId,
    req.user?.id ?? null
  );
  res.status(200).json({ success: true, message: 'تم إلغاء تفعيل المستخدم بنجاح', data: user });
});

const activateUser = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await userAdminService.activateUser(
    req.organizationId,
    req.params.userId,
    req.user?.id ?? null
  );
  res.status(200).json({ success: true, message: 'تم تفعيل المستخدم بنجاح', data: user });
});

module.exports = { listUsers, getUserById, updateUser, deactivateUser, activateUser };
