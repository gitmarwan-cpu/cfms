const { param, query } = require('express-validator');
export {};

const notificationListValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('unreadOnly').optional().isBoolean(),
];
const notificationIdValidation = [param('id').isInt({ min: 1 })];

module.exports = { notificationListValidation, notificationIdValidation };
