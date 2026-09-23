import express from 'express';
import * as auditController from '../controllers/auditController';
import validate from '../middlewares/validate';
import { authenticate, authorizePlatformPermission } from '../middlewares/auth';
import { auditLogListValidation } from '../validations/auditValidation';

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorizePlatformPermission('platform.audit.view'),
  validate(auditLogListValidation),
  auditController.listPlatform
);

export default router;
