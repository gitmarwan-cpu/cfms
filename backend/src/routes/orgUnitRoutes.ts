import express from 'express';
import * as orgUnitController from '../controllers/orgUnitController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { typeIdParamValidation, createTypeValidation, updateTypeValidation } from '../validations/orgUnitValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/unit-types', authorizePermission('org_structure.view'), orgUnitController.listTypes);
router.post('/unit-types', authorizePermission('org_structure.manage'), validate(createTypeValidation), orgUnitController.createType);
router.put('/unit-types/:typeId', authorizePermission('org_structure.manage'), validate([...typeIdParamValidation, ...updateTypeValidation]), orgUnitController.updateType);

export default router;
