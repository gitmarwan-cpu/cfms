import express from 'express';
import * as reportController from '../controllers/reportController';
import validate from '../middlewares/validate';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { complaintReportValidation } from '../validations/reportValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.get('/complaints', authorizePermission('complaints.view_all'), validate(complaintReportValidation), reportController.complaintSummary);

export default router;
