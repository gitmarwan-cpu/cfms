const { body } = require('express-validator');
const { passwordPolicyBodyValidation } = require('./passwordPolicy');
export {};

const loginValidation = [
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
];

// Password rules come from the shared password policy (validations/passwordPolicy.ts)
// so registration, self-service change and admin reset always agree.
const registerValidation = [
  body('fullName').isLength({ min: 2, max: 150 }).withMessage('الاسم الكامل مطلوب'),
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  passwordPolicyBodyValidation('password'),
  body('roleCode').optional().isLength({ min: 2, max: 60 }),
];

// Self-service password change (POST /auth/change-password) — account-level,
// authenticated-only route; the shared policy governs the new password.
const changePasswordValidation = [
  body('currentPassword').isString().notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  passwordPolicyBodyValidation('newPassword'),
];

module.exports = { loginValidation, registerValidation, changePasswordValidation };
