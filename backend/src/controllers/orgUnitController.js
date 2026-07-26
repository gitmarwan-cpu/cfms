'use strict';

const catchAsync = require('../utils/catchAsync');
const orgUnitTypeService = require('../services/orgUnitTypeService');
const orgUnitService = require('../services/orgUnitService');

// ملاحظة أمنية مهمة: organizationId يُؤخذ الآن من req.organizationId (الذي
// يضبطه middlewares/tenant.js بعد التحقق الفعلي من عضوية المستخدم)، وليس
// من req.params.organizationId كما كان سابقاً - إذ كان بالإمكان لأي مستخدم
// مصادَق عليه استبدال الرقم في الرابط والوصول لهيكل مؤسسة أخرى بالكامل.

// --- أنواع الوحدات التنظيمية (مستويات الهيكل القابلة للتخصيص) ---

const listTypes = catchAsync(async (req, res) => {
  const types = await orgUnitTypeService.listTypes(req.organizationId);
  res.status(200).json({ success: true, data: types });
});

const createType = catchAsync(async (req, res) => {
  const type = await orgUnitTypeService.createType(req.organizationId, req.body);
  res.status(201).json({ success: true, message: 'تمت إضافة نوع الوحدة التنظيمية', data: type });
});

const updateType = catchAsync(async (req, res) => {
  const type = await orgUnitTypeService.updateType(req.organizationId, req.params.typeId, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث نوع الوحدة التنظيمية', data: type });
});

// --- الوحدات التنظيمية الفعلية (الشجرة) ---

const listUnits = catchAsync(async (req, res) => {
  const units = await orgUnitService.listUnits(req.organizationId);
  res.status(200).json({ success: true, data: units });
});

const createUnit = catchAsync(async (req, res) => {
  const unit = await orgUnitService.createUnit(req.organizationId, req.body);
  res.status(201).json({ success: true, message: 'تمت إضافة الوحدة التنظيمية', data: unit });
});

const updateUnit = catchAsync(async (req, res) => {
  const unit = await orgUnitService.updateUnit(req.organizationId, req.params.unitId, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث الوحدة التنظيمية', data: unit });
});

const deactivateUnit = catchAsync(async (req, res) => {
  await orgUnitService.deactivateUnit(req.organizationId, req.params.unitId);
  res.status(200).json({ success: true, message: 'تم إلغاء تفعيل الوحدة التنظيمية' });
});

module.exports = { listTypes, createType, updateType, listUnits, createUnit, updateUnit, deactivateUnit };
