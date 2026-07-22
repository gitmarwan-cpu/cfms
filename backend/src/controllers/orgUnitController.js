'use strict';

const catchAsync = require('../utils/catchAsync');
const orgUnitTypeService = require('../services/orgUnitTypeService');
const orgUnitService = require('../services/orgUnitService');

// --- أنواع الوحدات التنظيمية (مستويات الهيكل القابلة للتخصيص) ---

const listTypes = catchAsync(async (req, res) => {
  const types = await orgUnitTypeService.listTypes(req.params.organizationId);
  res.status(200).json({ success: true, data: types });
});

const createType = catchAsync(async (req, res) => {
  const type = await orgUnitTypeService.createType(req.params.organizationId, req.body);
  res.status(201).json({ success: true, message: 'تمت إضافة نوع الوحدة التنظيمية', data: type });
});

const updateType = catchAsync(async (req, res) => {
  const type = await orgUnitTypeService.updateType(req.params.organizationId, req.params.typeId, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث نوع الوحدة التنظيمية', data: type });
});

// --- الوحدات التنظيمية الفعلية (الشجرة) ---

const listUnits = catchAsync(async (req, res) => {
  const units = await orgUnitService.listUnits(req.params.organizationId);
  res.status(200).json({ success: true, data: units });
});

const createUnit = catchAsync(async (req, res) => {
  const unit = await orgUnitService.createUnit(req.params.organizationId, req.body);
  res.status(201).json({ success: true, message: 'تمت إضافة الوحدة التنظيمية', data: unit });
});

const updateUnit = catchAsync(async (req, res) => {
  const unit = await orgUnitService.updateUnit(req.params.organizationId, req.params.unitId, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث الوحدة التنظيمية', data: unit });
});

const deactivateUnit = catchAsync(async (req, res) => {
  await orgUnitService.deactivateUnit(req.params.organizationId, req.params.unitId);
  res.status(200).json({ success: true, message: 'تم إلغاء تفعيل الوحدة التنظيمية' });
});

module.exports = { listTypes, createType, updateType, listUnits, createUnit, updateUnit, deactivateUnit };
