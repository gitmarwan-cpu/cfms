import type { AppRequest, AppResponse } from '../types/http';
import catchAsync from '../utils/catchAsync';
import * as roleService from '../services/roleService';

const listPlatformRoles = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await roleService.listPlatformRoles() }));
const getPlatformRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await roleService.getPlatformRoleById(req.params.id) }));
const createPlatformRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تم إنشاء دور المنصة بنجاح', data: await roleService.createPlatformRole(req.body, req.user?.id) }));
const updatePlatformRole = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث دور المنصة بنجاح', data: await roleService.updatePlatformRole(req.params.id, req.body, req.user?.id) }));
const listPlatformPermissions = catchAsync(async (_req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await roleService.listPlatformPermissions() }));

export { listPlatformRoles, getPlatformRole, createPlatformRole, updatePlatformRole, listPlatformPermissions };
