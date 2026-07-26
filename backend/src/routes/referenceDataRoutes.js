'use strict';

const express = require('express');
const referenceDataController = require('../controllers/referenceDataController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const {
  listKeyParamValidation,
  itemIdParamValidation,
  createItemValidation,
  updateItemValidation,
} = require('../validations/referenceDataValidation');

const router = express.Router();

// المسار العام (بدون مصادقة) لجلب عناصر قائمة معينة لنموذج تقديم الشكوى
// انتقل إلى publicRoutes.js تحت /api/public/:orgSlug/reference-data/:key/items
// لأنه يعتمد على تحديد المؤسسة عبر slug وليس عبر جلسة موظف مسجَّل دخوله.

router.use(authenticate, resolveAuthenticatedTenant);

router.get('/', authorizePermission('reference_data.view'), referenceDataController.listAllLists);

router.get(
  '/:key/items/admin',
  authorizePermission('reference_data.view'),
  validate(listKeyParamValidation),
  referenceDataController.getAdminItems
);

router.post(
  '/:key/items',
  authorizePermission('reference_data.manage'),
  validate(createItemValidation),
  referenceDataController.createItem
);

router.put(
  '/:key/items/:itemId',
  authorizePermission('reference_data.manage'),
  validate(updateItemValidation),
  referenceDataController.updateItem
);

router.patch(
  '/:key/items/:itemId/deactivate',
  authorizePermission('reference_data.manage'),
  validate(itemIdParamValidation),
  referenceDataController.deactivateItem
);

module.exports = router;
