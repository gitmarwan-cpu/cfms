import express from 'express';
import * as organizationController from '../controllers/organizationController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import {
  updateOrganizationValidation,
  createNodeValidation,
  updateNodeValidation,
  nodeIdParamValidation,
} from '../validations/organizationValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);

router.get('/', authorizePermission('organization.view'), organizationController.getOwnSettings);
router.put('/', authorizePermission('organization.manage'), validate(updateOrganizationValidation), organizationController.updateSettings);

router.get('/nodes', authorizePermission('org_structure.view'), organizationController.listNodes);
router.post('/nodes', authorizePermission('org_structure.manage'), validate(createNodeValidation), organizationController.createNode);
router.put('/nodes/:id', authorizePermission('org_structure.manage'), validate(updateNodeValidation), organizationController.updateNode);
router.patch('/nodes/:id/deactivate', authorizePermission('org_structure.manage'), validate(nodeIdParamValidation), organizationController.deactivateNode);
router.patch('/nodes/:id/activate', authorizePermission('org_structure.manage'), validate(nodeIdParamValidation), organizationController.activateNode);

export default router;
