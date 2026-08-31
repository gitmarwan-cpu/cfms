const { body } = require('express-validator');
export {};

/**
 * Shared password policy (Phase 3) — the single authoritative rule set for
 * every endpoint that accepts a new password:
 *
 *   - POST /auth/register              (registration, field: password)
 *   - POST /auth/change-password       (self-service, field: newPassword)
 *   - POST /users/:userId/reset-password (admin-issued, field: newPassword)
 *
 * The rules are exactly the ones historically enforced on registration
 * (minimum length 8 + at least one digit). Do not duplicate this rule set
 * elsewhere; extend it here so every password path stays in sync.
 */
export interface PasswordPolicyResult {
  valid: boolean;
  message: string | null;
}

const PASSWORD_RULES: Array<{ test: (value: string) => boolean; message: string }> = [
  { test: (value) => value.length >= 8, message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' },
  { test: (value) => /\d/.test(value), message: 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل' },
];

/**
 * Validates a candidate password against the shared policy.
 * Never returns or logs the password value itself.
 */
export const validatePasswordPolicy = (password: string): PasswordPolicyResult => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      return { valid: false, message: rule.message };
    }
  }
  return { valid: true, message: null };
};

/**
 * express-validator chain enforcing the shared policy on a request body field.
 * Uses `.custom` so the exact shared messages reach the client unchanged.
 */
const passwordPolicyBodyValidation = (field: string) =>
  body(field)
    .isString()
    .withMessage('كلمة المرور مطلوبة')
    .custom((value: string) => {
      const result = validatePasswordPolicy(value);
      if (!result.valid) throw new Error(result.message ?? 'كلمة المرور غير صالحة');
      return true;
    });

module.exports = { validatePasswordPolicy, passwordPolicyBodyValidation };
