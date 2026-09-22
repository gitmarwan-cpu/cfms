const { query } = require('express-validator');
const auditLogListValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('entityType').optional().isLength({ min: 1, max: 100 }),
  query('entityId').optional().isInt({ min: 1 }),
];

export { auditLogListValidation };
