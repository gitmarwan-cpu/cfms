import express from 'express';
import * as platformTenantController from '../controllers/platformTenantController';
import validate from '../middlewares/validate';
import { authenticate, authorizePlatformPermission, authorizeAnyPlatformPermission } from '../middlewares/auth';
import { createTenantValidation } from '../validations/tenantProvisioningValidation';
import { platformTenantLifecycleValidation } from '../validations/platformTenantLifecycleValidation';
import { platformTenantDiscoveryValidation } from '../validations/platformTenantDiscoveryValidation';
import type { LifecycleStatus } from '../services/tenantLifecycleService';

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

const lifecycleRoute = (nextStatus: LifecycleStatus) => [
  authenticate,
  authorizePlatformPermission('platform.tenant.lifecycle'),
  validate(platformTenantLifecycleValidation),
  platformTenantController.transitionTenant(nextStatus),
];

router.patch('/tenants/:organizationId/suspend', ...lifecycleRoute('suspended'));
router.patch('/tenants/:organizationId/reactivate', ...lifecycleRoute('active'));
router.patch('/tenants/:organizationId/deactivate', ...lifecycleRoute('deactivated'));
router.patch('/tenants/:organizationId/archive', ...lifecycleRoute('archived'));

export default router;
