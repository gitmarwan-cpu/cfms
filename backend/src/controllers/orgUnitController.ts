import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const orgUnitTypeService = require('../services/orgUnitTypeService');
export {};

const listTypes = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await orgUnitTypeService.listTypes(req.organizationId) }));
const createType = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تمت إضافة نوع الوحدة التنظيمية', data: await orgUnitTypeService.createType(req.organizationId, req.body) }));
const updateType = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث نوع الوحدة التنظيمية', data: await orgUnitTypeService.updateType(req.organizationId, req.params.typeId, req.body) }));

module.exports = { listTypes, createType, updateType };
