import express from 'express';
import * as referenceDataController from '../controllers/referenceDataController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { listKeyParamValidation, itemIdParamValidation, createItemValidation, updateItemValidation } from '../validations/referenceDataValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/', authorizePermission('reference_data.view'), referenceDataController.listAllLists);
router.get('/:key/items/admin', authorizePermission('reference_data.view'), validate(listKeyParamValidation), referenceDataController.getAdminItems);
router.post('/:key/items', authorizePermission('reference_data.manage'), validate(createItemValidation), referenceDataController.createItem);
router.put('/:key/items/:itemId', authorizePermission('reference_data.manage'), validate(updateItemValidation), referenceDataController.updateItem);
router.patch('/:key/items/:itemId/deactivate', authorizePermission('reference_data.manage'), validate(itemIdParamValidation), referenceDataController.deactivateItem);

export default router;
