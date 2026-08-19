import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const organizationService = require('../services/organizationService');
export {};

const getOwnSettings = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await organizationService.getOwnOrganization(req.organizationId) }));
const updateSettings = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث إعدادات المؤسسة', data: await organizationService.updateOrganization(req.organizationId, req.body) }));

module.exports = { getOwnSettings, updateSettings };
