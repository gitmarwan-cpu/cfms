const express = require('express');
const organizationController = require('../controllers/organizationController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { updateOrganizationValidation } = require('../validations/organizationValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/', authorizePermission('organization.view'), organizationController.getOwnSettings);
router.put('/', authorizePermission('organization.manage'), validate(updateOrganizationValidation), organizationController.updateSettings);

module.exports = router;
