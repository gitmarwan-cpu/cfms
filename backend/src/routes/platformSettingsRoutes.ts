import express from 'express';
import * as platformSettingsController from '../controllers/platformSettingsController';
import validate from '../middlewares/validate';
import { authenticate, authorizePlatformPermission } from '../middlewares/auth';
import { updateEmailSettingsValidation } from '../validations/platformSettingsValidation';
import { testEmailRateLimiter } from '../middlewares/rateLimiter';

const router = express.Router();

router.use(authenticate, authorizePlatformPermission('platform.settings.manage'));

router.get('/email', platformSettingsController.getEmailSettings);
router.put('/email', validate(updateEmailSettingsValidation), platformSettingsController.updateEmailSettings);
router.post('/email/test', testEmailRateLimiter, platformSettingsController.testEmailSettings);

export default router;
