const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { loginRateLimiter } = require('../middlewares/rateLimiter');
const { loginValidation, registerValidation, changePasswordValidation } = require('../validations/authValidation');

export {};

const router = express.Router();
router.post('/login', loginRateLimiter, validate(loginValidation), authController.login);
router.post('/register', authenticate, resolveAuthenticatedTenant, authorizePermission('users.manage'), validate(registerValidation), authController.register);
// Account-level (not tenant-scoped): authenticate only — the password belongs
// to the user, not to any organization context.
router.post('/change-password', authenticate, validate(changePasswordValidation), authController.changePassword);
router.get('/me', authenticate, authController.me);

module.exports = router;
