const express = require('express');
const auditController = require('../controllers/auditController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { auditLogListValidation } = require('../validations/auditValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant, authorizePermission('audit.view'));
router.get('/', validate(auditLogListValidation), auditController.list);

module.exports = router;
