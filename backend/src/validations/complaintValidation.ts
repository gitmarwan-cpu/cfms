const { body, param, query } = require('express-validator');
export {};
const referenceDataService = require('../services/referenceDataService');

const TYPE_VALUES = ['complaint', 'proposal'];
const STATUS_VALUES = ['new', 'in_review', 'resolved', 'closed', 'rejected'];

const isActiveReferenceCode = (listKey: string) => async (value: string, { req }: { req: any }): Promise<boolean> => {
  if (!req.organizationId) {
    throw new Error('سياق المؤسسة غير محدد - خطأ داخلي في ترتيب الـ middleware');
  }
  await referenceDataService.resolveActiveItem(listKey, value, req.organizationId);
  return true;
};

const createComplaintValidation = [
  body('type').isIn(TYPE_VALUES).withMessage('نوع الطلب يجب أن يكون شكوى أو مقترح'),
  body('isAnonymous').optional().isBoolean().toBoolean(),
  body('fullName').if(body('isAnonymous').equals('false')).optional({ checkFalsy: true }).isLength({ min: 2, max: 150 }).withMessage('الاسم الكامل يجب أن يكون بين 2 و150 حرفاً'),
  body('gender').optional({ checkFalsy: true }).custom(isActiveReferenceCode('gender')).withMessage('قيمة الجنس غير صالحة'),
  body('ageGroup').optional({ checkFalsy: true }).custom(isActiveReferenceCode('age_group')).withMessage('الفئة العمرية غير صالحة'),
  body('relationship').optional({ checkFalsy: true }).custom(isActiveReferenceCode('complainant_relationship')).withMessage('علاقة مقدّم الطلب بالمؤسسة غير صالحة'),
  body('phone').if(body('isAnonymous').equals('false')).trim().notEmpty().withMessage('رقم الهاتف مطلوب عند اختيار الإفصاح عن الهوية').bail().matches(/^[0-9+\- ]{6,20}$/).withMessage('رقم الهاتف غير صالح'),
  body('phone').if(body('isAnonymous').not().equals('false')).optional({ checkFalsy: true }).matches(/^[0-9+\- ]{6,20}$/).withMessage('رقم الهاتف غير صالح'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('projectReferenceCode').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('isRelatedToStaff').optional().isBoolean().toBoolean(),
  body('relatedStaffName').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('relatedStaffPosition').optional({ checkFalsy: true }).trim().isLength({ max: 150 }),
  body('staffIncidentDetails').optional({ checkFalsy: true }).trim().isLength({ max: 3000 }),
  body('governorateId').notEmpty().withMessage('المحافظة مطلوبة').isInt({ min: 1 }).withMessage('معرّف المحافظة غير صالح'),
  body('districtId').notEmpty().withMessage('المديرية مطلوبة').isInt({ min: 1 }).withMessage('معرّف المديرية غير صالح'),
  body('village').optional({ checkFalsy: true }).isLength({ max: 150 }),
  body('category').custom(isActiveReferenceCode('complaint_category')).withMessage('تصنيف الشكوى غير صالح'),
  body('priority').optional({ checkFalsy: true }).custom(isActiveReferenceCode('complaint_priority')).withMessage('أولوية الشكوى غير صالحة'),
  body('isSensitive').optional().isBoolean().toBoolean(),
  body('description').trim().notEmpty().withMessage('وصف الشكوى/المقترح مطلوب').isLength({ min: 10, max: 5000 }).withMessage('الوصف يجب أن يكون بين 10 و5000 حرف'),
  body('desiredResolution').optional({ checkFalsy: true }).isLength({ max: 2000 }),
  body('beneficiaryExternalId').optional({ checkFalsy: true }).isLength({ max: 100 }),
  body('channel').optional({ checkFalsy: true }).custom(isActiveReferenceCode('channel')).withMessage('قناة الاستلام غير صالحة'),
  body('consentGiven').toBoolean().equals('true').withMessage('يجب الموافقة على معالجة البيانات لتقديم الطلب'),
];

const listComplaintsValidation = [
  query('status').optional().isIn(STATUS_VALUES),
  query('governorateId').optional().isInt({ min: 1 }),
  query('districtId').optional().isInt({ min: 1 }),
  query('category').optional().custom(isActiveReferenceCode('complaint_category')),
  query('priority').optional().custom(isActiveReferenceCode('complaint_priority')),
  query('isSensitive').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const complaintIdParamValidation = [param('id').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح')];
const updateStatusValidation = [
  param('id').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح'),
  body('status').isIn(STATUS_VALUES).withMessage('حالة غير صالحة'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 1000 }),
];
const assignmentValidation = [
  param('id').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح'),
  body('assigneeUserId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('المستخدم المعيّن غير صالح'),
  body('assigneeOrgUnitId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('الوحدة التنظيمية المعيّنة غير صالحة'),
];
const escalateComplaintValidation = [
  param('id').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح'),
  body('note').optional({ checkFalsy: true }).isLength({ max: 1000 }),
];
const trackComplaintValidation = [
  body('referenceCode').trim().notEmpty().withMessage('الرقم المرجعي مطلوب'),
  body('pin').trim().isLength({ min: 6, max: 6 }).withMessage('رمز المتابعة يجب أن يكون 6 أرقام').isNumeric().withMessage('رمز المتابعة يجب أن يكون أرقاماً فقط'),
];

module.exports = { createComplaintValidation, listComplaintsValidation, complaintIdParamValidation, updateStatusValidation, assignmentValidation, escalateComplaintValidation, trackComplaintValidation };
