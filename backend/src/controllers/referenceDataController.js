'use strict';

const catchAsync = require('../utils/catchAsync');
const referenceDataService = require('../services/referenceDataService');

const listAllLists = catchAsync(async (req, res) => {
  const lists = await referenceDataService.getAllLists();
  res.status(200).json({ success: true, data: lists });
});

/**
 * عام (بدون مصادقة): يُستخدم من نموذج تقديم الشكوى وأي واجهة عامة
 * لجلب عناصر قائمة معينة (مفعّلة فقط).
 */
const getPublicItems = catchAsync(async (req, res) => {
  const items = await referenceDataService.getItemsByListKey(req.params.key);
  res.status(200).json({ success: true, data: items });
});

/**
 * محمي (admin): يعيد كل العناصر بما فيها المعطّلة، لإدارتها من لوحة الإدارة.
 */
const getAdminItems = catchAsync(async (req, res) => {
  const items = await referenceDataService.getItemsByListKey(req.params.key, { includeInactive: true });
  res.status(200).json({ success: true, data: items });
});

const createItem = catchAsync(async (req, res) => {
  const item = await referenceDataService.createItem(req.params.key, req.body);
  res.status(201).json({ success: true, message: 'تمت إضافة العنصر بنجاح', data: item });
});

const updateItem = catchAsync(async (req, res) => {
  const item = await referenceDataService.updateItem(req.params.key, req.params.itemId, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث العنصر بنجاح', data: item });
});

const deactivateItem = catchAsync(async (req, res) => {
  const item = await referenceDataService.deactivateItem(req.params.key, req.params.itemId);
  res.status(200).json({ success: true, message: 'تم إلغاء تفعيل العنصر', data: item });
});

module.exports = {
  listAllLists,
  getPublicItems,
  getAdminItems,
  createItem,
  updateItem,
  deactivateItem,
};
