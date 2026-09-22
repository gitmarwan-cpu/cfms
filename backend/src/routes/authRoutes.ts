import express from 'express';
import * as authController from '../controllers/authController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { loginRateLimiter } from '../middlewares/rateLimiter';
import { loginValidation, registerValidation, changePasswordValidation } from '../validations/authValidation';

const router = express.Router();
router.post('/login', loginRateLimiter, validate(loginValidation), authController.login);
router.post('/register', authenticate, resolveAuthenticatedTenant, authorizePermission('users.manage'), validate(registerValidation), authController.register);
// Account-level (not tenant-scoped): authenticate only — the password belongs
// to the user, not to any organization context.
router.post('/change-password', authenticate, validate(changePasswordValidation), authController.changePassword);
router.get('/me', authenticate, authController.me);

export default router;
