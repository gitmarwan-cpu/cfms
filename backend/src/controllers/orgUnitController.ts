import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const orgUnitTypeService = require('../services/orgUnitTypeService');
const orgUnitService = require('../services/orgUnitService');
export {};

const listTypes = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await orgUnitTypeService.listTypes(req.organizationId) }));
const createType = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تمت إضافة نوع الوحدة التنظيمية', data: await orgUnitTypeService.createType(req.organizationId, req.body) }));
const updateType = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث نوع الوحدة التنظيمية', data: await orgUnitTypeService.updateType(req.organizationId, req.params.typeId, req.body) }));
const listUnits = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await orgUnitService.listUnits(req.organizationId) }));
const createUnit = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تمت إضافة الوحدة التنظيمية', data: await orgUnitService.createUnit(req.organizationId, req.body) }));
const updateUnit = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث الوحدة التنظيمية', data: await orgUnitService.updateUnit(req.organizationId, req.params.unitId, req.body) }));
const deactivateUnit = catchAsync(async (req: AppRequest, res: AppResponse) => { await orgUnitService.deactivateUnit(req.organizationId, req.params.unitId); res.status(200).json({ success: true, message: 'تم إلغاء تفعيل الوحدة التنظيمية' }); });

module.exports = { listTypes, createType, updateType, listUnits, createUnit, updateUnit, deactivateUnit };
