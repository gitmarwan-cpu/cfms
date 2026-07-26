'use strict';

const express = require('express');
const organizationController = require('../controllers/organizationController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { updateOrganizationValidation } = require('../validations/organizationValidation');

const router = express.Router();

// المسار العام (Slug-based) انتقل إلى: GET /api/public/:orgSlug/organization

router.use(authenticate, resolveAuthenticatedTenant);

router.get('/', authorizePermission('organization.view'), organizationController.getOwnSettings);

/**
 * PUT /api/organization
 * تنبيه أمني (تمت معالجته): لم يعد يقبل :id من الرابط - العميل لا يستطيع
 * تحديد أي مؤسسة يعدّل؛ المؤسسة هي دائماً مؤسسة المستخدم الحالي حصراً.
 */
router.put(
  '/',
  authorizePermission('organization.manage'),
  validate(updateOrganizationValidation),
  organizationController.updateSettings
);

module.exports = router;
