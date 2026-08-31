const express = require('express');
const userRoleController = require('../controllers/userRoleController');
const userAdminController = require('../controllers/userAdminController');
const membershipController = require('../controllers/membershipController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { userIdParamValidation, userRoleIdParamValidation, assignRoleValidation } = require('../validations/userRoleValidation');
const { listUsersValidation, userAdminIdParamValidation, updateUserValidation } = require('../validations/userAdminValidation');
const { membershipIdParamValidation, addMembershipValidation, resetPasswordValidation } = require('../validations/userMembershipValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);

// ── User list (GET /) ─────────────────────────────────────────────────────────
router.get('/', authorizePermission('users.view'), validate(listUsersValidation), userAdminController.listUsers);

// ── Routes with static path segments ─────────────────────────────────────────
// IMPORTANT: These must be declared before the dynamic /:userId routes so that
// Express matches /roles/:id, /memberships/:id and /:userId/reset-password
// before falling through to /:userId.
router.get('/:userId/roles', authorizePermission('users.view'), validate(userIdParamValidation), userRoleController.listUserRoles);
router.post('/:userId/roles', authorizePermission('users.manage'), validate(assignRoleValidation), userRoleController.assignRole);
router.delete('/roles/:userRoleId', authorizePermission('users.manage'), validate(userRoleIdParamValidation), userRoleController.revokeRole);

// ── Membership lifecycle (Phase 3) ───────────────────────────────────────────
// The target organization is ALWAYS req.organizationId (tenant context from
// the JWT + X-Organization-Id header) — never a client-supplied identifier.
router.get('/:userId/memberships', authorizePermission('users.view'), validate(userIdParamValidation), membershipController.listMemberships);
router.post('/:userId/memberships', authorizePermission('users.manage'), validate(addMembershipValidation), membershipController.addMembership);
router.delete('/memberships/:membershipId', authorizePermission('users.manage'), validate(membershipIdParamValidation), membershipController.removeMembership);
router.patch('/memberships/:membershipId/primary', authorizePermission('users.manage'), validate(membershipIdParamValidation), membershipController.setPrimaryMembership);

// ── Admin-issued password reset (Phase 3) ────────────────────────────────────
router.post('/:userId/reset-password', authorizePermission('users.manage'), validate(resetPasswordValidation), userAdminController.resetPassword);

// ── User detail / update / activate / deactivate (dynamic /:userId) ───────────
router.get('/:userId', authorizePermission('users.view'), validate(userAdminIdParamValidation), userAdminController.getUserById);
router.put('/:userId', authorizePermission('users.manage'), validate(updateUserValidation), userAdminController.updateUser);
router.patch('/:userId/deactivate', authorizePermission('users.manage'), validate(userAdminIdParamValidation), userAdminController.deactivateUser);
router.patch('/:userId/activate', authorizePermission('users.manage'), validate(userAdminIdParamValidation), userAdminController.activateUser);

module.exports = router;
