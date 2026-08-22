import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const userGroupService = require('../services/userGroupService');
export {};

const listUserGroups = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await userGroupService.listUserGroups(req.organizationId, req.params.userId) }));
const addUserToGroup = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تمت إضافة المستخدم للمجموعة بنجاح', data: await userGroupService.addUserToGroup(req.organizationId, { userId: req.params.userId, groupId: req.body.groupId }, req.user?.id) }));
const removeUserFromGroup = catchAsync(async (req: AppRequest, res: AppResponse) => { await userGroupService.removeUserFromGroup(req.organizationId, req.params.userGroupId, req.user?.id); res.status(200).json({ success: true, message: 'تمت إزالة المستخدم من المجموعة' }); });

module.exports = { listUserGroups, addUserToGroup, removeUserFromGroup };
