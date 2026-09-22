import express from 'express';
import * as auditController from '../controllers/auditController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { auditLogListValidation } from '../validations/auditValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant, authorizePermission('audit.view'));
router.get('/', validate(auditLogListValidation), auditController.list);

export default router;
