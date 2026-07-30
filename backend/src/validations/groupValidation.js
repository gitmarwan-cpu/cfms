'use strict';

const { param, body } = require('express-validator');

const groupIdParamValidation = [param('id').isInt({ min: 1 }).withMessage('معرّف المجموعة غير صالح')];

const createGroupValidation = [
  body('code')
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('كود المجموعة مطلوب')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('كود المجموعة يجب أن يحتوي أحرفاً إنجليزية صغيرة وأرقاماً و _ فقط'),
  body('nameAr').trim().isLength({ min: 2, max: 100 }).withMessage('الاسم بالعربية مطلوب'),
  body('nameEn').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }),
  body('roleIds').optional().isArray().withMessage('يجب أن تكون قائمة معرّفات أدوار'),
  body('roleIds.*').optional().isInt({ min: 1 }),
];

const updateGroupValidation = [
  ...groupIdParamValidation,
  body('nameAr').optional().trim().isLength({ min: 2, max: 100 }),
  body('nameEn').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('roleIds').optional().isArray().withMessage('يجب أن تكون قائمة معرّفات أدوار'),
  body('roleIds.*').optional().isInt({ min: 1 }),
];

module.exports = { groupIdParamValidation, createGroupValidation, updateGroupValidation };
