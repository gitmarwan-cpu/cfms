import { body } from 'express-validator';

export const updateEmailSettingsValidation = [
  body('host')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('عنوان خادم البريد (Host) مطلوب ويجب ألا يتجاوز 255 حرفاً'),
  body('port')
    .isInt({ min: 1, max: 65535 })
    .withMessage('المنفذ (Port) يجب أن يكون رقماً صحيحاً بين 1 و 65535'),
  body('secure')
    .isBoolean()
    .withMessage('حقل الاتصال الآمن (secure) يجب أن يكون قيمة منطقية (true/false)'),
  body('username')
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('اسم المستخدم (Username) مطلوب ويجب ألا يتجاوز 255 حرفاً'),
  body('senderEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('البريد الإلكتروني للمرسل غير صالح'),
  body('senderName')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 150 })
    .withMessage('اسم المرسل يجب ألا يتجاوز 150 حرفاً'),
  body('password')
    .optional({ nullable: true })
    .isString()
    .withMessage('كلمة المرور يجب أن تكون نصاً'),
];
