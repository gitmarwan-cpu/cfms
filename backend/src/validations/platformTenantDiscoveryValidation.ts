const { param, query } = require('express-validator');
export {};

const lifecycleStatuses = ['provisioning', 'active', 'suspended', 'deactivated', 'archived'];

const organizationIdValidation = [
  param('organizationId').isInt({ min: 1 }).withMessage('معرّف المؤسسة غير صالح'),
];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('رقم الصفحة يجب أن يكون عدداً صحيحاً موجباً'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  query('search').optional().isString().isLength({ max: 150 }).withMessage('نص البحث طويل جداً'),
  query('lifecycleStatus')
    .optional()
    .isIn(lifecycleStatuses)
    .withMessage('حالة دورة الحياة غير صالحة'),
];

const platformTenantDiscoveryValidation = {
  list: listValidation,
  detail: organizationIdValidation,
};

module.exports = { platformTenantDiscoveryValidation };
