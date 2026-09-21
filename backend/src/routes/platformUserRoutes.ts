const express = require('express');
const platformUserController = require('../controllers/platformUserController');
const platformMembershipDiscoveryValidation = require('../validations/platformMembershipDiscoveryValidation');
const validate = require('../middlewares/validate');
const { authenticate, authorizePlatformPermission } = require('../middlewares/auth');
const {
  platformUserIdParamValidation,
  platformOrganizationUserParams,
  listPlatformUsersValidation,
  listMembershipUserOptionsValidation,
  createPlatformUserValidation,
  platformRoleAssignmentValidation,
  platformRoleChangeValidation,
} = require('../validations/platformUserValidation');
export {};

const router = express.Router();
const platformUsers = [authenticate, authorizePlatformPermission('platform.users.manage')];
const platformMemberships = [authenticate, authorizePlatformPermission('platform.memberships.manage')];

router.get('/users', ...platformUsers, validate(listPlatformUsersValidation), platformUserController.listUsers);
router.get(
  '/membership-user-options',
  ...platformMemberships,
  validate(listMembershipUserOptionsValidation),
  platformUserController.listMembershipUserOptions
);
router.post('/users', ...platformUsers, validate(createPlatformUserValidation), platformUserController.createUser);
router.get('/users/:userId', ...platformUsers, validate(platformUserIdParamValidation), platformUserController.getUserById);
router.patch('/users/:userId/deactivate', ...platformUsers, validate(platformUserIdParamValidation), platformUserController.deactivateUser);
router.patch('/users/:userId/activate', ...platformUsers, validate(platformUserIdParamValidation), platformUserController.activateUser);

router.get(
  '/tenants/:organizationId/memberships',
  ...platformMemberships,
  validate(platformMembershipDiscoveryValidation.listMembershipsValidation),
  platformUserController.listTenantMemberships
);
router.get(
  '/tenants/:organizationId/roles',
  ...platformMemberships,
  validate(platformMembershipDiscoveryValidation.tenantParamValidation),
  platformUserController.listTenantRoles
);
router.get(
  '/tenants/:organizationId/organization-nodes',
  ...platformMemberships,
  validate(platformMembershipDiscoveryValidation.tenantParamValidation),
  platformUserController.listTenantOrganizationNodes
);

router.post(
  '/tenants/:organizationId/users/:userId/membership',
  ...platformMemberships,
  validate(platformOrganizationUserParams),
  platformUserController.addMembership
);
router.delete(
  '/tenants/:organizationId/users/:userId/membership',
  ...platformMemberships,
  validate(platformOrganizationUserParams),
  platformUserController.removeMembership
);
router.patch(
  '/tenants/:organizationId/users/:userId/membership/primary',
  ...platformMemberships,
  validate(platformOrganizationUserParams),
  platformUserController.setPrimaryMembership
);
router.post(
  '/tenants/:organizationId/users/:userId/roles',
  ...platformMemberships,
  validate(platformRoleAssignmentValidation),
  platformUserController.assignRole
);
router.patch(
  '/tenants/:organizationId/users/:userId/roles/:userRoleId',
  ...platformMemberships,
  validate(platformRoleChangeValidation),
  platformUserController.changeRole
);

module.exports = router;
