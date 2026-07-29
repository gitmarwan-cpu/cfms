'use strict';

const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { loginRateLimiter } = require('../middlewares/rateLimiter');
const { loginValidation, registerValidation } = require('../validations/authValidation');

const router = express.Router();

router.post('/login', loginRateLimiter, validate(loginValidation), authController.login);

/**
 * إنشاء مستخدمين جدد يتطلب صلاحية users.manage (وليس اسم دور ثابت)،
 * بما يتوافق مع نظام RBAC الجديد القائم على الصلاحيات لا الأدوار المباشرة.
 * الدور admin يملك هذه الصلاحية افتراضياً (راجع seeder الصلاحيات).
 */
router.post(
  '/register',
  authenticate,
  resolveAuthenticatedTenant,
  authorizePermission('users.manage'),
  validate(registerValidation),
  authController.register
);

router.get('/me', authenticate, authController.me);

module.exports = router;
