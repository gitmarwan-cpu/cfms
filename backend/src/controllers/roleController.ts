import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const roleService = require('../services/roleService');
export {};

const listRoles = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await roleService.listRoles(req.organizationId) }));
const getRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await roleService.getRoleById(req.organizationId, req.params.id) }));
const createRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تم إنشاء الدور بنجاح', data: await roleService.createRole(req.organizationId, req.body, req.user?.id) }));
const updateRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث الدور بنجاح', data: await roleService.updateRole(req.organizationId, req.params.id, req.body, req.user?.id) }));
const deleteRole = catchAsync(async (req: AppRequest, res: AppResponse) => { await roleService.deleteRole(req.organizationId, req.params.id, req.user?.id); res.status(200).json({ success: true, message: 'تم حذف الدور بنجاح' }); });
const listPermissions = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await roleService.listPermissions() }));

module.exports = { listRoles, getRole, createRole, updateRole, deleteRole, listPermissions };
