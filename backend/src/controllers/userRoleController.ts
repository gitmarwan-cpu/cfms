import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const userRoleService = require('../services/userRoleService');
export {};

const listUserRoles = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await userRoleService.listUserRoles(req.organizationId, req.params.userId) }));
const assignRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تم إسناد الدور بنجاح', data: await userRoleService.assignRole(req.organizationId, { userId: req.params.userId, roleId: req.body.roleId, organizationNodeId: req.body.organizationNodeId }) }));
const revokeRole = catchAsync(async (req: AppRequest, res: AppResponse) => { await userRoleService.revokeRole(req.organizationId, req.params.userRoleId); res.status(200).json({ success: true, message: 'تم إلغاء تعيين الدور' }); });

module.exports = { listUserRoles, assignRole, revokeRole };
