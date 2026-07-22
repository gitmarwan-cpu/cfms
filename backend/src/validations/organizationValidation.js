'use strict';

const { param, body } = require('express-validator');

const orgIdParamValidation = [param('id').isInt({ min: 1 }).withMessage('معرّف المؤسسة غير صالح')];

const HEX_COLOR = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const updateOrganizationValidation = [
  ...orgIdParamValidation,
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

module.exports = { orgIdParamValidation, updateOrganizationValidation };
