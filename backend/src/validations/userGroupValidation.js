'use strict';

const { param, body } = require('express-validator');

const userIdParamValidation = [param('userId').isInt({ min: 1 }).withMessage('معرّف المستخدم غير صالح')];

const userGroupIdParamValidation = [param('userGroupId').isInt({ min: 1 }).withMessage('معرّف العضوية غير صالح')];

const addUserToGroupValidation = [
  ...userIdParamValidation,
  body('groupId').isInt({ min: 1 }).withMessage('معرّف المجموعة مطلوب'),
];

module.exports = { userIdParamValidation, userGroupIdParamValidation, addUserToGroupValidation };
