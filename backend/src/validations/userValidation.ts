const { param, query, body } = require('express-validator');
export {};

const userIdParamValidation = [param('userId').isInt({ min: 1 }).withMessage('معرّف المستخدم غير صالح')];

const listUsersValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional({ checkFalsy: true }).trim().isLength({ max: 150 }).withMessage('نص البحث طويل جداً'),
  query('isActive').optional().isBoolean(),
];

const updateUserStatusValidation = [
  ...userIdParamValidation,
  body('isActive').isBoolean().withMessage('حالة المستخدم مطلوبة'),
];

module.exports = { userIdParamValidation, listUsersValidation, updateUserStatusValidation };