'use strict';

const { body, param, query } = require('express-validator');

const CATEGORY_VALUES = [
  'service_quality',
  'staff_behavior',
  'corruption_fraud',
  'distribution_issue',
  'protection_gbv',
  'suggestion',
  'other',
];
const CHANNEL_VALUES = [
  'in_person',
  'hotline',
  'suggestion_box',
  'email',
  'field_visit',
  'website',
];
const STATUS_VALUES = ['new', 'in_review', 'resolved', 'closed', 'rejected'];
const AGE_GROUP_VALUES = ['under_18', '18_30', '31_45', '46_60', 'above_60'];

const createComplaintValidation = [
  body('type')
    .isIn(['complaint', 'proposal'])
    .withMessage('نوع الطلب يجب أن يكون شكوى أو مقترح'),
  body('isAnonymous').optional().isBoolean().toBoolean(),
  body('fullName')
    .if(body('isAnonymous').equals('false'))
    .optional({ checkFalsy: true })
    .isLength({ min: 2, max: 150 })
    .withMessage('الاسم الكامل يجب أن يكون بين 2 و150 حرفاً'),
  body('gender').optional({ checkFalsy: true }).isIn(['male', 'female']),
  body('ageGroup').optional({ checkFalsy: true }).isIn(AGE_GROUP_VALUES),
  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^[0-9+\- ]{6,20}$/)
    .withMessage('رقم الهاتف غير صالح'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('governorateId')
    .notEmpty()
    .withMessage('المحافظة مطلوبة')
    .isInt({ min: 1 })
    .withMessage('معرّف المحافظة غير صالح'),
  body('districtId')
    .notEmpty()
    .withMessage('المديرية مطلوبة')
    .isInt({ min: 1 })
    .withMessage('معرّف المديرية غير صالح'),
  body('village').optional({ checkFalsy: true }).isLength({ max: 150 }),
  body('category').isIn(CATEGORY_VALUES).withMessage('تصنيف الشكوى غير صالح'),
  body('isSensitive').optional().isBoolean().toBoolean(),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('وصف الشكوى/المقترح مطلوب')
    .isLength({ min: 10, max: 5000 })
    .withMessage('الوصف يجب أن يكون بين 10 و5000 حرف'),
  body('desiredResolution').optional({ checkFalsy: true }).isLength({ max: 2000 }),
  body('channel').optional().isIn(CHANNEL_VALUES),
  body('consentGiven')
    .toBoolean()
    .equals('true')
    .withMessage('يجب الموافقة على معالجة البيانات لتقديم الطلب'),
];

const listComplaintsValidation = [
  query('status').optional().isIn(STATUS_VALUES),
  query('governorateId').optional().isInt({ min: 1 }),
  query('districtId').optional().isInt({ min: 1 }),
  query('category').optional().isIn(CATEGORY_VALUES),
  query('isSensitive').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const complaintIdParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح'),
];

const updateStatusValidation = [
  param('id').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح'),
  body('status').isIn(STATUS_VALUES).withMessage('حالة غير صالحة'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 1000 }),
];

module.exports = {
  createComplaintValidation,
  listComplaintsValidation,
  complaintIdParamValidation,
  updateStatusValidation,
};
