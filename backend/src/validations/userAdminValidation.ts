const { query, body, param } = require('express-validator');
export {};

const listUsersValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('رقم الصفحة يجب أن يكون عدداً صحيحاً موجباً'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  query('search').optional().isString().isLength({ max: 150 }).withMessage('نص البحث طويل جداً'),
  query('isActive').optional().isIn(['true', 'false']).withMessage('قيمة isActive يجب أن تكون true أو false'),
];

const userAdminIdParamValidation = [
  param('userId').isInt({ min: 1 }).withMessage('معرّف المستخدم يجب أن يكون عدداً صحيحاً موجباً'),
];

const updateUserValidation = [
  param('userId').isInt({ min: 1 }).withMessage('معرّف المستخدم يجب أن يكون عدداً صحيحاً موجباً'),
  body('fullName')
    .optional()
    .isString()
    .isLength({ min: 2, max: 150 })
    .withMessage('الاسم الكامل يجب أن يكون بين 2 و 150 حرفاً'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('البريد الإلكتروني غير صالح'),
  body('primaryOrganizationNodeId')
    .optional({ nullable: true, checkFalsy: false })
    .custom((value: unknown) => {
      if (value === null || value === '') return true;
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1) throw new Error('معرّف العقدة التنظيمية غير صالح');
      return true;
    }),
];

module.exports = { listUsersValidation, userAdminIdParamValidation, updateUserValidation };
