import express from 'express';
import * as roleController from '../controllers/roleController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { roleIdParamValidation, createRoleValidation, updateRoleValidation } from '../validations/roleValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/permissions', authorizePermission('roles.view'), roleController.listPermissions);
router.get('/', authorizePermission('roles.view'), roleController.listRoles);
router.get('/:id', authorizePermission('roles.view'), validate(roleIdParamValidation), roleController.getRole);
router.post('/', authorizePermission('roles.manage'), validate(createRoleValidation), roleController.createRole);
router.put('/:id', authorizePermission('roles.manage'), validate(updateRoleValidation), roleController.updateRole);
router.delete('/:id', authorizePermission('roles.manage'), validate(roleIdParamValidation), roleController.deleteRole);

export default router;
