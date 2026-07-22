'use strict';

const express = require('express');
const organizationController = require('../controllers/organizationController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { updateOrganizationValidation } = require('../validations/organizationValidation');

const router = express.Router();

/**
 * GET /api/organization
 * عام: يوفر بيانات الهوية البصرية (الاسم، الشعار، الألوان) للواجهة العامة.
 */
router.get('/', organizationController.getPublicSettings);

/**
 * PUT /api/organization/:id
 * محمي (admin فقط): تحديث إعدادات المؤسسة من لوحة الإدارة.
 */
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(updateOrganizationValidation),
  organizationController.updateSettings
);

module.exports = router;
