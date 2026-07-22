'use strict';

const express = require('express');
const orgUnitController = require('../controllers/orgUnitController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  organizationIdParamValidation,
  typeIdParamValidation,
  unitIdParamValidation,
  createTypeValidation,
  updateTypeValidation,
  createUnitValidation,
  updateUnitValidation,
} = require('../validations/orgUnitValidation');

const router = express.Router({ mergeParams: true });

// كل مسارات الهيكل التنظيمي محمية بصلاحية admin فقط (لوحة الإدارة)
router.use(authenticate, authorize('admin'));

// --- أنواع الوحدات (مستويات الهيكل القابلة للتخصيص) ---
router.get('/:organizationId/unit-types', validate(organizationIdParamValidation), orgUnitController.listTypes);
router.post('/:organizationId/unit-types', validate(createTypeValidation), orgUnitController.createType);
router.put('/:organizationId/unit-types/:typeId', validate(updateTypeValidation), orgUnitController.updateType);

// --- الوحدات التنظيمية الفعلية (الشجرة) ---
router.get('/:organizationId/units', validate(organizationIdParamValidation), orgUnitController.listUnits);
router.post('/:organizationId/units', validate(createUnitValidation), orgUnitController.createUnit);
router.put('/:organizationId/units/:unitId', validate(updateUnitValidation), orgUnitController.updateUnit);
router.patch(
  '/:organizationId/units/:unitId/deactivate',
  validate(unitIdParamValidation),
  orgUnitController.deactivateUnit
);

module.exports = router;
