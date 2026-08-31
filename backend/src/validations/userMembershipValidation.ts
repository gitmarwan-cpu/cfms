const { param, body } = require('express-validator');
const { passwordPolicyBodyValidation } = require('./passwordPolicy');
export {};

/**
 * Validation chains for the Phase 3 membership + password endpoints.
 *
 * SECURITY: POST /users/:userId/memberships must NEVER accept an
 * organizationId from the client — the target organization is always the
 * authenticated tenant context (req.organizationId). The explicit
 * `.not().exists()` chain below turns any attempt to inject one into a 422
 * instead of silently ignoring it.
 */
const userIdParamValidation = [param('userId').isInt({ min: 1 }).withMessage('معرّف المستخدم غير صالح')];

const membershipIdParamValidation = [param('membershipId').isInt({ min: 1 }).withMessage('معرّف العضوية غير صالح')];

const addMembershipValidation = [
  ...userIdParamValidation,
  body('organizationId')
    .not()
    .exists()
    .withMessage('لا يمكن تحديد المؤسسة في الطلب؛ تُشتق من سياق المصادقة'),
];

const resetPasswordValidation = [
  ...userIdParamValidation,
  passwordPolicyBodyValidation('newPassword'),
];

module.exports = {
  userIdParamValidation,
  membershipIdParamValidation,
  addMembershipValidation,
  resetPasswordValidation,
};
