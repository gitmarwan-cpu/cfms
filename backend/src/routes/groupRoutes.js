'use strict';

const express = require('express');
const groupController = require('../controllers/groupController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { groupIdParamValidation, createGroupValidation, updateGroupValidation } = require('../validations/groupValidation');

const router = express.Router();

router.use(authenticate, resolveAuthenticatedTenant);

router.get('/', authorizePermission('groups.view'), groupController.listGroups);
router.get('/:id', authorizePermission('groups.view'), validate(groupIdParamValidation), groupController.getGroup);
router.post('/', authorizePermission('groups.manage'), validate(createGroupValidation), groupController.createGroup);
router.put('/:id', authorizePermission('groups.manage'), validate(updateGroupValidation), groupController.updateGroup);
router.delete(
  '/:id',
  authorizePermission('groups.manage'),
  validate(groupIdParamValidation),
  groupController.deleteGroup
);

module.exports = router;
