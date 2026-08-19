const express = require('express');
const userRoleController = require('../controllers/userRoleController');
const userGroupController = require('../controllers/userGroupController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { userIdParamValidation, userRoleIdParamValidation, assignRoleValidation } = require('../validations/userRoleValidation');
const { userGroupIdParamValidation, addUserToGroupValidation } = require('../validations/userGroupValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/:userId/roles', authorizePermission('users.view'), validate(userIdParamValidation), userRoleController.listUserRoles);
router.post('/:userId/roles', authorizePermission('users.manage'), validate(assignRoleValidation), userRoleController.assignRole);
router.delete('/roles/:userRoleId', authorizePermission('users.manage'), validate(userRoleIdParamValidation), userRoleController.revokeRole);
router.get('/:userId/groups', authorizePermission('users.view'), validate(userIdParamValidation), userGroupController.listUserGroups);
router.post('/:userId/groups', authorizePermission('users.manage'), validate(addUserToGroupValidation), userGroupController.addUserToGroup);
router.delete('/groups/:userGroupId', authorizePermission('users.manage'), validate(userGroupIdParamValidation), userGroupController.removeUserFromGroup);

module.exports = router;
