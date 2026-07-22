'use strict';

const express = require('express');
const referenceDataController = require('../controllers/referenceDataController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  listKeyParamValidation,
  itemIdParamValidation,
  createItemValidation,
  updateItemValidation,
} = require('../validations/referenceDataValidation');

const router = express.Router();

/**
 * GET /api/reference-data/:key/items
 * مسار عام (بدون مصادقة) يُستخدم من نموذج تقديم الشكوى وأي واجهة عامة
 * لجلب القوائم المرجعية (التصنيفات، القنوات، الأعمار...) بدلاً من ثوابت الكود.
 */
router.get('/:key/items', validate(listKeyParamValidation), referenceDataController.getPublicItems);

/**
 * كل ما يلي محمي بصلاحية admin فقط لإدارة البيانات المرجعية من لوحة الإدارة.
 */
router.get('/', authenticate, authorize('admin'), referenceDataController.listAllLists);

router.get(
  '/:key/items/admin',
  authenticate,
  authorize('admin'),
  validate(listKeyParamValidation),
  referenceDataController.getAdminItems
);

router.post(
  '/:key/items',
  authenticate,
  authorize('admin'),
  validate(createItemValidation),
  referenceDataController.createItem
);

router.put(
  '/:key/items/:itemId',
  authenticate,
  authorize('admin'),
  validate(updateItemValidation),
  referenceDataController.updateItem
);

router.patch(
  '/:key/items/:itemId/deactivate',
  authenticate,
  authorize('admin'),
  validate(itemIdParamValidation),
  referenceDataController.deactivateItem
);

module.exports = router;
