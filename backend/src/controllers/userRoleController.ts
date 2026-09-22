import type { AppRequest, AppResponse } from '../types/http';
import catchAsync from '../utils/catchAsync';
import * as userRoleService from '../services/userRoleService';
const listUserRoles = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await userRoleService.listUserRoles(req.organizationId!, req.params.userId) }));
const assignRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تم إسناد الدور بنجاح', data: await userRoleService.assignRole(req.organizationId!, { userId: req.params.userId, roleId: req.body.roleId, organizationNodeId: req.body.organizationNodeId }, req.user?.id ?? null) }));
const revokeRole = catchAsync(async (req: AppRequest, res: AppResponse) => { await userRoleService.revokeRole(req.organizationId!, req.params.userRoleId, req.user?.id ?? null); res.status(200).json({ success: true, message: 'تم إلغاء تعيين الدور' }); });

export { listUserRoles, assignRole, revokeRole };
