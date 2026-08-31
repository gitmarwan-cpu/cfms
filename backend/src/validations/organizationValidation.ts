const { body, param } = require('express-validator');
export {};

const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const updateOrganizationValidation = [
  body('legalName').optional().trim().isLength({ min: 2, max: 200 }),
  body('shortName').optional({ checkFalsy: true }).isLength({ max: 80 }),
  body('logoUrl').optional({ checkFalsy: true }).isURL().withMessage('رابط الشعار غير صالح'),
  body('faviconUrl').optional({ checkFalsy: true }).isURL().withMessage('رابط الأيقونة غير صالح'),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('website').optional({ checkFalsy: true }).isURL(),
  body('governorateId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('latitude').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  body('defaultLanguage').optional().isIn(['ar', 'en']),
  body('primaryColor').optional().matches(HEX_COLOR).withMessage('صيغة اللون غير صالحة'),
  body('secondaryColor').optional().matches(HEX_COLOR).withMessage('صيغة اللون غير صالحة'),
  body('accentColor').optional().matches(HEX_COLOR).withMessage('صيغة اللون غير صالحة'),
  body('anonymousComplaintsPolicy').optional().isIn(['allowed', 'not_allowed', 'optional']),
  body('notificationSettings').optional().isObject(),
  body('isActive').optional().isBoolean().toBoolean(),
];

const createOrganizationValidation = [
  body('legalName').trim().notEmpty().withMessage('اسم المؤسسة مطلوب').isLength({ min: 2, max: 200 }),
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('معرّف المؤسسة (slug) مطلوب')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('معرّف المؤسسة (slug) غير صالح: أحرف لاتينية صغيرة وأرقام وشرطات فقط')
    .isLength({ min: 3, max: 80 }),
  body('shortName').optional({ checkFalsy: true }).isLength({ max: 80 }),
  body('description').optional({ checkFalsy: true }),
  body('countryId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('governorateId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('districtId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('website').optional({ checkFalsy: true }).isURL(),
];

const createNodeValidation = [
  body('name').trim().notEmpty().withMessage('اسم الوحدة التنظيمية مطلوب').isLength({ min: 2, max: 200 }),
  body('orgUnitTypeId').isInt({ min: 1 }).withMessage('نوع الوحدة التنظيمية غير صالح'),
  body('parentId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('code').optional({ checkFalsy: true }).isLength({ max: 60 }),
  body('shortName').optional({ checkFalsy: true }).isLength({ max: 80 }),
  body('countryId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('governorateId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('districtId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('address').optional({ checkFalsy: true }),
  body('latitude').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

const updateNodeValidation = [
  param('id').isInt({ min: 1 }).withMessage('معرف الوحدة غير صالح'),
  body('name').optional().trim().isLength({ min: 2, max: 200 }),
  body('orgUnitTypeId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('parentId').optional({ checkNull: true }),
  body('code').optional({ checkFalsy: true }).isLength({ max: 60 }),
  body('shortName').optional({ checkFalsy: true }).isLength({ max: 80 }),
  body('countryId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('governorateId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('districtId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  body('phone').optional({ checkFalsy: true }).isLength({ max: 30 }),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('address').optional({ checkFalsy: true }),
  body('latitude').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
  body('isActive').optional().isBoolean().toBoolean(),
];

const nodeIdParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('معرف الوحدة غير صالح'),
];

module.exports = {
  updateOrganizationValidation,
  createOrganizationValidation,
  createNodeValidation,
  updateNodeValidation,
  nodeIdParamValidation,
};

