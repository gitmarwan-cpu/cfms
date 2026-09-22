import express from 'express';
import * as notificationController from '../controllers/notificationController';
import validate from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { notificationListValidation, notificationIdValidation } from '../validations/notificationValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/', validate(notificationListValidation), notificationController.list);
router.patch('/:id/read', validate(notificationIdValidation), notificationController.markRead);

export default router;
