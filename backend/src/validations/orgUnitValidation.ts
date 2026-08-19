const { param, body } = require('express-validator');
export {};

const typeIdParamValidation = [param('typeId').isInt({ min: 1 }).withMessage('معرّف نوع الوحدة غير صالح')];
const unitIdParamValidation = [param('unitId').isInt({ min: 1 }).withMessage('معرّف الوحدة التنظيمية غير صالح')];
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
const createUnitValidation = [
  body('orgUnitTypeId').isInt({ min: 1 }).withMessage('نوع الوحدة التنظيمية مطلوب'),
  body('parentId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('name').trim().notEmpty().withMessage('اسم الوحدة مطلوب').isLength({ max: 200 }),
  body('code').optional({ checkFalsy: true }).isLength({ max: 60 }),
  body('managerUserId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('phone').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{6,20}$/),
  body('email').optional({ checkFalsy: true }).isEmail(),
];
const updateUnitValidation = [
  body('orgUnitTypeId').optional().isInt({ min: 1 }),
  body('parentId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('name').optional().trim().isLength({ min: 1, max: 200 }),
  body('code').optional({ checkFalsy: true }).isLength({ max: 60 }),
  body('managerUserId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('phone').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{6,20}$/),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('isActive').optional().isBoolean().toBoolean(),
];

module.exports = { typeIdParamValidation, unitIdParamValidation, createTypeValidation, updateTypeValidation, createUnitValidation, updateUnitValidation };
