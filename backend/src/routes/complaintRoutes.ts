import express from 'express';
import * as complaintController from '../controllers/complaintController';
import validate from '../middlewares/validate';
import upload, { validateUploadedFileSignatures } from '../middlewares/upload';
import { authenticate, authorizePermission } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { createComplaintValidation, listComplaintsValidation, complaintIdParamValidation, updateStatusValidation, assignmentValidation, escalateComplaintValidation } from '../validations/complaintValidation';

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.post('/', authorizePermission('complaints.create'), upload.array('attachments', 3), validateUploadedFileSignatures, validate(createComplaintValidation), complaintController.createStaffComplaint);
router.get('/', authorizePermission('complaints.view_all'), validate(listComplaintsValidation), complaintController.listComplaints);
router.get('/:id/transitions', authorizePermission('complaints.assign'), validate(complaintIdParamValidation), complaintController.listComplaintTransitions);
router.get('/:id', authorizePermission('complaints.view_all'), validate(complaintIdParamValidation), complaintController.getComplaint);
router.patch('/:id/status', authorizePermission('complaints.assign'), validate(updateStatusValidation), complaintController.updateComplaintStatus);
router.patch('/:id/assignment', authorizePermission('complaints.assign'), validate(assignmentValidation), complaintController.assignComplaint);
router.post('/:id/escalate', authorizePermission('complaints.escalate'), validate(escalateComplaintValidation), complaintController.escalateComplaint);
router.post('/:id/regenerate-pin', authorizePermission('complaints.assign'), validate(complaintIdParamValidation), complaintController.regenerateTrackingPin);

export default router;
