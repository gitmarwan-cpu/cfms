const { body, param, query } = require('express-validator');
const { passwordPolicyBodyValidation } = require('./passwordPolicy');
export {};

const platformUserIdParamValidation = [
  param('userId').isInt({ min: 1 }).withMessage('معرّف المستخدم غير صالح'),
];

const platformOrganizationUserParams = [
  param('organizationId').isInt({ min: 1 }).withMessage('معرّف المؤسسة غير صالح'),
  ...platformUserIdParamValidation,
];

const listPlatformUsersValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('رقم الصفحة يجب أن يكون عدداً صحيحاً موجباً'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  query('search').optional().isString().isLength({ max: 150 }).withMessage('نص البحث طويل جداً'),
  query('isActive').optional().isIn(['true', 'false']).withMessage('قيمة isActive يجب أن تكون true أو false'),
];

const listMembershipUserOptionsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('رقم الصفحة يجب أن يكون عدداً صحيحاً موجباً'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('الحد الأقصى للنتائج يجب أن يكون بين 1 و 100'),
  query('search').optional().isString().isLength({ max: 150 }).withMessage('نص البحث طويل جداً'),
];

const createPlatformUserValidation = [
  body('fullName').isString().isLength({ min: 2, max: 150 }).withMessage('الاسم الكامل يجب أن يكون بين 2 و 150 حرفاً'),
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  passwordPolicyBodyValidation('password'),
];

const platformRoleAssignmentValidation = [
  ...platformOrganizationUserParams,
  body('roleId').isInt({ min: 1 }).withMessage('معرّف الدور مطلوب'),
  body('organizationNodeId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('معرّف العقدة التنظيمية غير صالح'),
];

const platformRoleChangeValidation = [
  ...platformRoleAssignmentValidation,
  param('userRoleId').isInt({ min: 1 }).withMessage('معرّف تعيين الدور غير صالح'),
];

module.exports = {
  platformUserIdParamValidation,
  platformOrganizationUserParams,
  listPlatformUsersValidation,
  listMembershipUserOptionsValidation,
  createPlatformUserValidation,
  platformRoleAssignmentValidation,
  platformRoleChangeValidation,
};
