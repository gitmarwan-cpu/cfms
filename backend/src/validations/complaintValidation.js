'use strict';

const { body, param, query } = require('express-validator');
const referenceDataService = require('../services/referenceDataService');

// نوع الطلب (complaint/proposal) وحالة سير العمل (status) يبقيان ثابتين لأنهما
// تمييز بنيوي أساسي في منطق النظام (وليسا "بيانات مرجعية" قابلة للتحرير من الإدارة)،
// خلافاً للتصنيف/القناة/الجنس/الفئة العمرية التي تُدار الآن من reference_list_items.
const TYPE_VALUES = ['complaint', 'proposal'];
const STATUS_VALUES = ['new', 'in_review', 'resolved', 'closed', 'rejected'];

/**
 * يبني custom validator للتحقق أن قيمة الحقل موجودة ومفعّلة ضمن قائمة مرجعية
 * معيّنة (بدلاً من isIn(ثابتة)). يرمي خطأ 422 عبر referenceDataService عند الفشل.
 */
const isActiveReferenceCode = (listKey) => async (value) => {
  await referenceDataService.resolveActiveItem(listKey, value);
  return true;
};

const createComplaintValidation = [
  body('type').isIn(TYPE_VALUES).withMessage('نوع الطلب يجب أن يكون شكوى أو مقترح'),
  body('isAnonymous').optional().isBoolean().toBoolean(),
  body('fullName')
    .if(body('isAnonymous').equals('false'))
    .optional({ checkFalsy: true })
    .isLength({ min: 2, max: 150 })
    .withMessage('الاسم الكامل يجب أن يكون بين 2 و150 حرفاً'),
  body('gender')
    .optional({ checkFalsy: true })
    .custom(isActiveReferenceCode('gender'))
    .withMessage('قيمة الجنس غير صالحة'),
  body('ageGroup')
    .optional({ checkFalsy: true })
    .custom(isActiveReferenceCode('age_group'))
    .withMessage('الفئة العمرية غير صالحة'),
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
  body('category')
    .custom(isActiveReferenceCode('complaint_category'))
    .withMessage('تصنيف الشكوى غير صالح'),
  body('isSensitive').optional().isBoolean().toBoolean(),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('وصف الشكوى/المقترح مطلوب')
    .isLength({ min: 10, max: 5000 })
    .withMessage('الوصف يجب أن يكون بين 10 و5000 حرف'),
  body('desiredResolution').optional({ checkFalsy: true }).isLength({ max: 2000 }),
  body('channel')
    .optional({ checkFalsy: true })
    .custom(isActiveReferenceCode('channel'))
    .withMessage('قناة الاستلام غير صالحة'),
  body('consentGiven')
    .toBoolean()
    .equals('true')
    .withMessage('يجب الموافقة على معالجة البيانات لتقديم الطلب'),
];

const listComplaintsValidation = [
  query('status').optional().isIn(STATUS_VALUES),
  query('governorateId').optional().isInt({ min: 1 }),
  query('districtId').optional().isInt({ min: 1 }),
  query('category').optional().custom(isActiveReferenceCode('complaint_category')),
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
