import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const referenceDataService = require('../services/referenceDataService');
export {};

const listAllLists = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await referenceDataService.listReferenceLists(req.organizationId) }));
const getAdminItems = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await referenceDataService.getItemsByListKey(req.params.key, req.organizationId, { includeInactive: true }) }));
const createItem = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(201).json({ success: true, message: 'تمت إضافة العنصر بنجاح', data: await referenceDataService.createItem(req.params.key, req.organizationId, req.body) }));
const updateItem = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم تحديث العنصر بنجاح', data: await referenceDataService.updateItem(req.params.key, req.params.itemId, req.organizationId, req.body) }));
const deactivateItem = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, message: 'تم إلغاء تفعيل العنصر', data: await referenceDataService.deactivateItem(req.params.key, req.organizationId, req.params.itemId) }));

module.exports = { listAllLists, getAdminItems, createItem, updateItem, deactivateItem };
