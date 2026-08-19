const { body } = require('express-validator');
export {};

const loginValidation = [
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
];

const registerValidation = [
  body('fullName').isLength({ min: 2, max: 150 }).withMessage('الاسم الكامل مطلوب'),
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('كلمة المرور يجب ألا تقل عن 8 أحرف')
    .matches(/\d/)
    .withMessage('يجب أن تحتوي كلمة المرور على رقم واحد على الأقل'),
  body('roleCode').optional().isLength({ min: 2, max: 60 }),
  body('orgUnitId').optional({ checkFalsy: true }).isInt({ min: 1 }),
];

module.exports = { loginValidation, registerValidation };
