import express from 'express';
import * as platformRoleController from '../controllers/platformRoleController';
import validate from '../middlewares/validate';
import { authenticate, authorizePlatformPermission } from '../middlewares/auth';
import {
  roleIdParamValidation,
  createRoleValidation,
  updateRoleValidation,
} from '../validations/roleValidation';

const router = express.Router();

router.use(authenticate, authorizePlatformPermission('platform.roles.manage'));

router.get('/permissions', platformRoleController.listPlatformPermissions);
router.get('/', platformRoleController.listPlatformRoles);
router.get('/:id', validate(roleIdParamValidation), platformRoleController.getPlatformRole);
router.post('/', validate(createRoleValidation), platformRoleController.createPlatformRole);
router.put('/:id', validate(updateRoleValidation), platformRoleController.updatePlatformRole);

export default router;
