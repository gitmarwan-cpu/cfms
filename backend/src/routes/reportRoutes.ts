const express = require('express');
const reportController = require('../controllers/reportController');
const validate = require('../middlewares/validate');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { complaintReportValidation } = require('../validations/reportValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/complaints', authorizePermission('complaints.view_all'), validate(complaintReportValidation), reportController.complaintSummary);

module.exports = router;
