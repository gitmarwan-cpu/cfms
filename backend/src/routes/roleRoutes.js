'use strict';

const express = require('express');
const roleController = require('../controllers/roleController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { roleIdParamValidation, createRoleValidation, updateRoleValidation } = require('../validations/roleValidation');

const router = express.Router();

router.use(authenticate, resolveAuthenticatedTenant);

router.get('/permissions', authorizePermission('roles.view'), roleController.listPermissions);

router.get('/', authorizePermission('roles.view'), roleController.listRoles);
router.get('/:id', authorizePermission('roles.view'), validate(roleIdParamValidation), roleController.getRole);
router.post('/', authorizePermission('roles.manage'), validate(createRoleValidation), roleController.createRole);
router.put('/:id', authorizePermission('roles.manage'), validate(updateRoleValidation), roleController.updateRole);
router.delete(
  '/:id',
  authorizePermission('roles.manage'),
  validate(roleIdParamValidation),
  roleController.deleteRole
);

module.exports = router;
