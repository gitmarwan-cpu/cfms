const { param, body } = require('express-validator');
export {};

const listKeyParamValidation = [param('key').matches(/^[a-z0-9_]+$/).withMessage('مفتاح القائمة غير صالح')];
const itemIdParamValidation = [...listKeyParamValidation, param('itemId').isInt({ min: 1 }).withMessage('معرّف العنصر غير صالح')];

const createItemValidation = [
  ...listKeyParamValidation,
  body('code').trim().matches(/^[a-z0-9_]+$/).withMessage('الرمز (code) يجب أن يحتوي أحرفاً إنجليزية صغيرة وأرقاماً وشرطة سفلية فقط'),
  body('labelAr').trim().notEmpty().withMessage('التسمية بالعربية مطلوبة').isLength({ max: 150 }),
  body('labelEn').optional({ checkFalsy: true }).isLength({ max: 150 }),
  body('sortOrder').optional().isInt(),
  body('isActive').optional().isBoolean().toBoolean(),
  body('isDefault').optional().isBoolean().toBoolean(),
];

const updateItemValidation = [
  ...itemIdParamValidation,
  body('labelAr').optional().trim().isLength({ min: 1, max: 150 }),
  body('labelEn').optional({ checkFalsy: true }).isLength({ max: 150 }),
  body('sortOrder').optional().isInt(),
  body('isActive').optional().isBoolean().toBoolean(),
  body('isDefault').optional().isBoolean().toBoolean(),
];

module.exports = { listKeyParamValidation, itemIdParamValidation, createItemValidation, updateItemValidation };
