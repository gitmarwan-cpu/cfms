const { body, param } = require('express-validator');
export {};

const TYPE_VALUES = ['complaint', 'proposal'];

const slaRuleIdParamValidation = [param('id').isInt({ min: 1 }).withMessage('معرّف قاعدة مهلة المعالجة غير صالح')];

const createSlaRuleValidation = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('اسم القاعدة مطلوب'),
  body('complaintType').optional({ nullable: true }).isIn(TYPE_VALUES).withMessage('نوع الطلب غير صالح'),
  body('categoryItemId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('معرّف التصنيف غير صالح'),
  body('priorityItemId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('معرّف الأولوية غير صالح'),
  body('isSensitive').optional({ nullable: true }).isBoolean(),
  body('firstResponseHours').isInt({ min: 1, max: 8760 }).withMessage('ساعات الاستجابة الأولى غير صالحة'),
  body('resolutionHours').isInt({ min: 1, max: 8760 }).withMessage('ساعات الحل غير صالحة'),
  body('escalationIntervalHours').isInt({ min: 1, max: 8760 }).withMessage('فترة التصعيد بالساعات غير صالحة'),
  body('maxEscalationLevel').optional().isInt({ min: 1, max: 10 }).withMessage('الحد الأقصى لمستوى التصعيد غير صالح'),
  body('isActive').optional().isBoolean().toBoolean(),
];

const updateSlaRuleValidation = [
  ...slaRuleIdParamValidation,
  body('name').optional().trim().isLength({ min: 2, max: 150 }).withMessage('اسم القاعدة غير صالح'),
  body('complaintType').optional({ nullable: true }).isIn(TYPE_VALUES).withMessage('نوع الطلب غير صالح'),
  body('categoryItemId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('معرّف التصنيف غير صالح'),
  body('priorityItemId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('معرّف الأولوية غير صالح'),
  body('isSensitive').optional({ nullable: true }).isBoolean(),
  body('firstResponseHours').optional().isInt({ min: 1, max: 8760 }).withMessage('ساعات الاستجابة الأولى غير صالحة'),
  body('resolutionHours').optional().isInt({ min: 1, max: 8760 }).withMessage('ساعات الحل غير صالحة'),
  body('escalationIntervalHours').optional().isInt({ min: 1, max: 8760 }).withMessage('فترة التصعيد بالساعات غير صالحة'),
  body('maxEscalationLevel').optional().isInt({ min: 1, max: 10 }).withMessage('الحد الأقصى لمستوى التصعيد غير صالح'),
  body('isActive').optional().isBoolean().toBoolean(),
];

module.exports = { slaRuleIdParamValidation, createSlaRuleValidation, updateSlaRuleValidation };
