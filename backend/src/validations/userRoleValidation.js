'use strict';

const { param, body } = require('express-validator');

const userIdParamValidation = [param('userId').isInt({ min: 1 }).withMessage('معرّف المستخدم غير صالح')];

const userRoleIdParamValidation = [param('userRoleId').isInt({ min: 1 }).withMessage('معرّف التعيين غير صالح')];

// ملاحظة أمنية: لا يوجد حقل organizationId هنا عمداً - المؤسسة تُؤخذ
// حصراً من resolveAuthenticatedTenant (سياق عضوية المُنفِّذ)، وليس من body.
const assignRoleValidation = [
  ...userIdParamValidation,
  body('roleId').isInt({ min: 1 }).withMessage('معرّف الدور مطلوب'),
  body('orgUnitId').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('معرّف الوحدة التنظيمية غير صالح'),
];

module.exports = { userIdParamValidation, userRoleIdParamValidation, assignRoleValidation };
