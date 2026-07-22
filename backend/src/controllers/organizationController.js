'use strict';

const catchAsync = require('../utils/catchAsync');
const organizationService = require('../services/organizationService');

/**
 * عام (بدون مصادقة): تحتاجه واجهة تقديم الشكوى العامة لعرض اسم المؤسسة،
 * الشعار، والهوية اللونية ديناميكياً بدلاً من تضمينها ثابتة في CSS/الكود.
 */
const getPublicSettings = catchAsync(async (req, res) => {
  const organization = await organizationService.getActiveOrganization();
  res.status(200).json({ success: true, data: organization });
});

const updateSettings = catchAsync(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث إعدادات المؤسسة', data: organization });
});

module.exports = { getPublicSettings, updateSettings };
