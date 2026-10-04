import { body } from 'express-validator';
import { passwordPolicyBodyValidation } from './passwordPolicy';
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
  // Node assignment fields (optional) — deep security validation is in authService.register()
  body('organizationNodeIds')
    .optional()
    .isArray({ max: 100 })
    .withMessage('organizationNodeIds يجب أن يكون مصفوفة'),
  body('organizationNodeIds.*')
    .isInt({ min: 1 })
    .withMessage('كل معرّف عقدة يجب أن يكون عدداً صحيحاً موجباً'),
  body('primaryOrganizationNodeId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('معرّف العقدة الافتراضية يجب أن يكون عدداً صحيحاً موجباً'),
];

// Self-service password change (POST /auth/change-password) — account-level,
// authenticated-only route; the shared policy governs the new password.
const changePasswordValidation = [
  body('currentPassword').isString().notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  passwordPolicyBodyValidation('newPassword'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
];

const resetPasswordValidation = [
  body('token')
    .isString()
    .withMessage('رمز إعادة التعيين مطلوب')
    .matches(/^[A-Za-z0-9_-]{43}$/)
    .withMessage('رمز إعادة التعيين غير صالح'),
  passwordPolicyBodyValidation('newPassword'),
];

export {
  loginValidation,
  registerValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
};
