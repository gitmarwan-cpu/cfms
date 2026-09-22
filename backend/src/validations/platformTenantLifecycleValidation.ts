const { body, param } = require('express-validator');
const organizationIdParamValidation = [
  param('organizationId').isInt({ min: 1 }).withMessage('معرّف المؤسسة غير صالح'),
];

const lifecycleReasonValidation = [
  body('reason')
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 255 })
    .withMessage('سبب تغيير الحالة يجب ألا يتجاوز 255 حرفاً'),
];

const platformTenantLifecycleValidation = [
  ...organizationIdParamValidation,
  ...lifecycleReasonValidation,
];

export { platformTenantLifecycleValidation };
