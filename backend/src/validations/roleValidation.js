'use strict';

const { param, body } = require('express-validator');

const roleIdParamValidation = [param('id').isInt({ min: 1 }).withMessage('معرّف الدور غير صالح')];

const createRoleValidation = [
  body('code')
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('كود الدور مطلوب')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('كود الدور يجب أن يحتوي أحرفاً إنجليزية صغيرة وأرقاماً و _ فقط'),
  body('nameAr').trim().isLength({ min: 2, max: 100 }).withMessage('الاسم بالعربية مطلوب'),
  body('nameEn').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }),
  body('permissionIds').optional().isArray().withMessage('يجب أن تكون قائمة معرّفات صلاحيات'),
  body('permissionIds.*').optional().isInt({ min: 1 }),
];

const updateRoleValidation = [
  ...roleIdParamValidation,
  body('nameAr').optional().trim().isLength({ min: 2, max: 100 }),
  body('nameEn').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }),
  body('isActive').optional().isBoolean().toBoolean(),
  body('permissionIds').optional().isArray().withMessage('يجب أن تكون قائمة معرّفات صلاحيات'),
  body('permissionIds.*').optional().isInt({ min: 1 }),
];

module.exports = { roleIdParamValidation, createRoleValidation, updateRoleValidation };
