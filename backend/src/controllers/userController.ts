import type { AppRequest, AppResponse } from '../types/http';

const catchAsync = require('../utils/catchAsync');
const userService = require('../services/userService');
export {};

const listUsers = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await userService.listUsers(req.organizationId, {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    isActive: req.query.isActive,
  });
  res.status(200).json({ success: true, data: result });
});

const updateUserStatus = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await userService.updateUserStatus(
    req.organizationId,
    req.params.userId,
    req.body.isActive,
    req.user?.id
  );
  res.status(200).json({
    success: true,
    message: req.body.isActive ? 'تم تفعيل المستخدم بنجاح' : 'تم تعطيل المستخدم بنجاح',
    data: user,
  });
});

module.exports = { listUsers, updateUserStatus };