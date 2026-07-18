'use strict';

const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { loginValidation, registerValidation } = require('../validations/authValidation');

const router = express.Router();

router.post('/login', validate(loginValidation), authController.login);

/**
 * إنشاء مستخدمي staff جدد يتطلب أن يكون المُنفِّذ admin مسجّل دخوله فعلاً،
 * لمنع أي شخص من إنشاء حسابات موظفين لنفسه.
 */
router.post(
  '/register',
  authenticate,
  authorize('admin'),
  validate(registerValidation),
  authController.register
);

router.get('/me', authenticate, authController.me);

module.exports = router;
