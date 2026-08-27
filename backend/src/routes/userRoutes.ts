const express = require('express');
const userRoleController = require('../controllers/userRoleController');
const userAdminController = require('../controllers/userAdminController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { userIdParamValidation, userRoleIdParamValidation, assignRoleValidation } = require('../validations/userRoleValidation');
const { listUsersValidation, userAdminIdParamValidation, updateUserValidation } = require('../validations/userAdminValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);

// ── User list (GET /) ─────────────────────────────────────────────────────────
router.get('/', authorizePermission('users.view'), validate(listUsersValidation), userAdminController.listUsers);

// ── Role routes with static path segments ────────────────────────────────────
// IMPORTANT: These must be declared before the dynamic /:userId routes so that
// Express matches /roles/:id before falling through to /:userId.
router.get('/:userId/roles', authorizePermission('users.view'), validate(userIdParamValidation), userRoleController.listUserRoles);
router.post('/:userId/roles', authorizePermission('users.manage'), validate(assignRoleValidation), userRoleController.assignRole);
router.delete('/roles/:userRoleId', authorizePermission('users.manage'), validate(userRoleIdParamValidation), userRoleController.revokeRole);

// ── User detail / update / activate / deactivate (dynamic /:userId) ───────────
router.get('/:userId', authorizePermission('users.view'), validate(userAdminIdParamValidation), userAdminController.getUserById);
router.put('/:userId', authorizePermission('users.manage'), validate(updateUserValidation), userAdminController.updateUser);
router.patch('/:userId/deactivate', authorizePermission('users.manage'), validate(userAdminIdParamValidation), userAdminController.deactivateUser);
router.patch('/:userId/activate', authorizePermission('users.manage'), validate(userAdminIdParamValidation), userAdminController.activateUser);

module.exports = router;
