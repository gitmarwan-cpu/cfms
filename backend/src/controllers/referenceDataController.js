'use strict';

const catchAsync = require('../utils/catchAsync');
const referenceDataService = require('../services/referenceDataService');

/**
 * كل ما يلي محمي (admin) ويعمل ضمن سياق مؤسسة المستخدم الحالي فقط
 * (req.organizationId من resolveAuthenticatedTenant). المسار العام غير
 * المصادَق عليه لجلب العناصر (لنموذج تقديم الشكوى) موجود في publicRoutes.js.
 */

const listAllLists = catchAsync(async (req, res) => {
  const lists = await referenceDataService.getAllLists(req.organizationId);
  res.status(200).json({ success: true, data: lists });
});

const getAdminItems = catchAsync(async (req, res) => {
  const items = await referenceDataService.getItemsByListKey(req.params.key, req.organizationId, {
    includeInactive: true,
  });
  res.status(200).json({ success: true, data: items });
});

const createItem = catchAsync(async (req, res) => {
  const item = await referenceDataService.createItem(req.params.key, req.organizationId, req.body);
  res.status(201).json({ success: true, message: 'تمت إضافة العنصر بنجاح', data: item });
});

const updateItem = catchAsync(async (req, res) => {
  const item = await referenceDataService.updateItem(req.params.key, req.organizationId, req.params.itemId, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث العنصر بنجاح', data: item });
});

const deactivateItem = catchAsync(async (req, res) => {
  const item = await referenceDataService.deactivateItem(req.params.key, req.organizationId, req.params.itemId);
  res.status(200).json({ success: true, message: 'تم إلغاء تفعيل العنصر', data: item });
});

module.exports = { listAllLists, getAdminItems, createItem, updateItem, deactivateItem };
