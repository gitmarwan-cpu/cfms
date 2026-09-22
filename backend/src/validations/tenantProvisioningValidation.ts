const { body } = require('express-validator');
import { passwordPolicyBodyValidation } from './passwordPolicy';
const createTenantValidation = [
  body('legalName').trim().notEmpty().withMessage('اسم المؤسسة مطلوب').isLength({ min: 2, max: 200 }),
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('معرّف المؤسسة (slug) مطلوب')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('معرّف المؤسسة (slug) غير صالح')
    .isLength({ min: 3, max: 80 }),
  body('shortName').optional({ checkFalsy: true }).isLength({ max: 80 }),
  body('description').optional({ checkFalsy: true }),
  body('countryId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('governorateId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('districtId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('website').optional({ checkFalsy: true }).isURL(),
  body('initialAdmin.fullName').trim().notEmpty().withMessage('اسم مدير المستأجر مطلوب').isLength({ min: 2, max: 150 }),
  body('initialAdmin.email').isEmail().withMessage('البريد الإلكتروني لمدير المستأجر غير صالح'),
  passwordPolicyBodyValidation('initialAdmin.password'),
];

export { createTenantValidation };
