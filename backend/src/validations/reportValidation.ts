const { query } = require('express-validator');
export {};

const complaintReportValidation = [
  query('from').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('تاريخ البداية غير صالح'),
  query('to').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('تاريخ النهاية غير صالح'),
];

module.exports = { complaintReportValidation };
