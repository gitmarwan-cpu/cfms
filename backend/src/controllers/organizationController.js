'use strict';

const catchAsync = require('../utils/catchAsync');
const organizationService = require('../services/organizationService');

/**
 * المسار العام (بدون مصادقة، عبر slug) انتقل إلى publicRoutes.js.
 * هذا الملف الآن للاستخدام الإداري فقط، ودائماً ضمن نطاق مؤسسة
 * المستخدم الحالي (req.organizationId من resolveAuthenticatedTenant).
 */

const getOwnSettings = catchAsync(async (req, res) => {
  const organization = await organizationService.getOwnOrganization(req.organizationId);
  res.status(200).json({ success: true, data: organization });
});

const updateSettings = catchAsync(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.organizationId, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث إعدادات المؤسسة', data: organization });
});

module.exports = { getOwnSettings, updateSettings };
