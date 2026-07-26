'use strict';

const express = require('express');
const userRoleController = require('../controllers/userRoleController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const {
  userIdParamValidation,
  userRoleIdParamValidation,
  assignRoleValidation,
} = require('../validations/userRoleValidation');

const router = express.Router();

router.use(authenticate, resolveAuthenticatedTenant);

router.get(
  '/:userId/roles',
  authorizePermission('users.view'),
  validate(userIdParamValidation),
  userRoleController.listUserRoles
);

router.post(
  '/:userId/roles',
  authorizePermission('users.manage'),
  validate(assignRoleValidation),
  userRoleController.assignRole
);

router.delete(
  '/roles/:userRoleId',
  authorizePermission('users.manage'),
  validate(userRoleIdParamValidation),
  userRoleController.revokeRole
);

module.exports = router;
