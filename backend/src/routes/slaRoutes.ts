import express from 'express';
import * as slaController from '../controllers/slaController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { createSlaRuleValidation, updateSlaRuleValidation } from '../validations/slaValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/', authorizePermission('organization.view'), slaController.listSlaRules);
router.post('/', authorizePermission('organization.manage'), validate(createSlaRuleValidation), slaController.createSlaRule);
router.post('/evaluate', authorizePermission('complaints.view_all'), slaController.evaluateSla);
router.patch('/:id', authorizePermission('organization.manage'), validate(updateSlaRuleValidation), slaController.updateSlaRule);

export default router;
