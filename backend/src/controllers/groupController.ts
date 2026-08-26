import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const groupService = require('../services/groupService');
export {};

const listGroups = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await groupService.listGroups(req.organizationId) }));
const getGroup = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await groupService.getGroupById(req.organizationId, req.params.id) }));
const createGroup = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تم إنشاء المجموعة بنجاح', data: await groupService.createGroup(req.organizationId, req.body, req.user?.id) }));
const updateGroup = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث المجموعة بنجاح', data: await groupService.updateGroup(req.organizationId, req.params.id, req.body, req.user?.id) }));
const deleteGroup = catchAsync(async (req: AppRequest, res: AppResponse) => { await groupService.deleteGroup(req.organizationId, req.params.id, req.user?.id); res.status(200).json({ success: true, message: 'تم حذف المجموعة بنجاح' }); });

module.exports = { listGroups, getGroup, createGroup, updateGroup, deleteGroup };
