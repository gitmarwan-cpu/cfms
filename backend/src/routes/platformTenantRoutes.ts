const express = require('express');
const platformTenantController = require('../controllers/platformTenantController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePlatformPermission, authorizeAnyPlatformPermission } = require('../middlewares/auth');
const { createTenantValidation } = require('../validations/tenantProvisioningValidation');
const { platformTenantLifecycleValidation } = require('../validations/platformTenantLifecycleValidation');
const { platformTenantDiscoveryValidation } = require('../validations/platformTenantDiscoveryValidation');
export {};

const router = express.Router();

const platformTenantLifecycle = [
  authenticate,
  authorizePlatformPermission('platform.tenant.lifecycle'),
];

const platformTenantDirectory = [
  authenticate,
  authorizeAnyPlatformPermission('platform.tenant.lifecycle', 'platform.memberships.manage'),
];

router.get(
  '/tenants',
  ...platformTenantDirectory,
  validate(platformTenantDiscoveryValidation.list),
  platformTenantController.listTenants
);

router.get(
  '/tenants/:organizationId',
  ...platformTenantLifecycle,
  validate(platformTenantDiscoveryValidation.detail),
  platformTenantController.getTenant
);

// Platform scope only: deliberately no tenant-resolution middleware.
router.post(
  '/tenants',
  authenticate,
  authorizePlatformPermission('platform.tenant.create'),
  validate(createTenantValidation),
  platformTenantController.createTenant
);

const lifecycleRoute = (nextStatus: string) => [
  authenticate,
  authorizePlatformPermission('platform.tenant.lifecycle'),
  validate(platformTenantLifecycleValidation),
  platformTenantController.transitionTenant(nextStatus),
];

router.patch('/tenants/:organizationId/suspend', ...lifecycleRoute('suspended'));
router.patch('/tenants/:organizationId/reactivate', ...lifecycleRoute('active'));
router.patch('/tenants/:organizationId/deactivate', ...lifecycleRoute('deactivated'));
router.patch('/tenants/:organizationId/archive', ...lifecycleRoute('archived'));

module.exports = router;
