const express = require('express');
const organizationController = require('../controllers/organizationController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const {
  updateOrganizationValidation,
  createOrganizationValidation,
  createNodeValidation,
  updateNodeValidation,
  nodeIdParamValidation,
} = require('../validations/organizationValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);

router.get('/', authorizePermission('organization.view'), organizationController.getOwnSettings);
router.put('/', authorizePermission('organization.manage'), validate(updateOrganizationValidation), organizationController.updateSettings);
router.post('/', authorizePermission('organization.create'), validate(createOrganizationValidation), organizationController.createOrganization);

router.get('/nodes', authorizePermission('org_structure.view'), organizationController.listNodes);
router.post('/nodes', authorizePermission('org_structure.manage'), validate(createNodeValidation), organizationController.createNode);
router.put('/nodes/:id', authorizePermission('org_structure.manage'), validate(updateNodeValidation), organizationController.updateNode);
router.patch('/nodes/:id/deactivate', authorizePermission('org_structure.manage'), validate(nodeIdParamValidation), organizationController.deactivateNode);

module.exports = router;

