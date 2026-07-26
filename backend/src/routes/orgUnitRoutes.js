'use strict';

const express = require('express');
const orgUnitController = require('../controllers/orgUnitController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const {
  typeIdParamValidation,
  unitIdParamValidation,
  createTypeValidation,
  updateTypeValidation,
  createUnitValidation,
  updateUnitValidation,
} = require('../validations/orgUnitValidation');

const router = express.Router();

/**
 * تنبيه أمني (تمت معالجته): كانت هذه المسارات سابقاً تأخذ organizationId
 * من الرابط مباشرة (/:organizationId/units)، وهو ما يسمح نظرياً لأي مستخدم
 * مصادَق عليه بتغيير الرقم في الرابط للوصول لهيكل مؤسسة أخرى بالكامل.
 * الآن: المؤسسة المستهدفة تُحدَّد حصراً عبر resolveAuthenticatedTenant
 * (يتحقق من عضوية المستخدم الفعلية عبر user_organizations)، وليس من الرابط.
 */
router.use(authenticate, resolveAuthenticatedTenant);

// --- أنواع الوحدات (مستويات الهيكل القابلة للتخصيص) ---
router.get('/unit-types', authorizePermission('org_structure.view'), orgUnitController.listTypes);
router.post(
  '/unit-types',
  authorizePermission('org_structure.manage'),
  validate(createTypeValidation),
  orgUnitController.createType
);
router.put(
  '/unit-types/:typeId',
  authorizePermission('org_structure.manage'),
  validate([...typeIdParamValidation, ...updateTypeValidation]),
  orgUnitController.updateType
);

// --- الوحدات التنظيمية الفعلية (الشجرة) ---
router.get('/units', authorizePermission('org_structure.view'), orgUnitController.listUnits);
router.post(
  '/units',
  authorizePermission('org_structure.manage'),
  validate(createUnitValidation),
  orgUnitController.createUnit
);
router.put(
  '/units/:unitId',
  authorizePermission('org_structure.manage'),
  validate([...unitIdParamValidation, ...updateUnitValidation]),
  orgUnitController.updateUnit
);
router.patch(
  '/units/:unitId/deactivate',
  authorizePermission('org_structure.manage'),
  validate(unitIdParamValidation),
  orgUnitController.deactivateUnit
);

module.exports = router;
