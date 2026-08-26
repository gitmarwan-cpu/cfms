const { param, body } = require('express-validator');
export {};

const typeIdParamValidation = [param('typeId').isInt({ min: 1 }).withMessage('معرّف نوع الوحدة غير صالح')];
const createTypeValidation = [
  body('code').trim().matches(/^[a-z0-9_]+$/).withMessage('الرمز (code) يجب أن يحتوي أحرفاً إنجليزية صغيرة وأرقاماً وشرطة سفلية فقط'),
  body('nameAr').trim().notEmpty().withMessage('الاسم بالعربية مطلوب').isLength({ max: 100 }),
  body('nameEn').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('hierarchyLevel').optional().isInt({ min: 1 }),
  body('allowedParentTypeId').optional({ checkFalsy: true }).isInt({ min: 1 }),
];
const updateTypeValidation = [
  body('nameAr').optional().trim().isLength({ min: 1, max: 100 }),
  body('nameEn').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('hierarchyLevel').optional().isInt({ min: 1 }),
  body('allowedParentTypeId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

module.exports = { typeIdParamValidation, createTypeValidation, updateTypeValidation };
