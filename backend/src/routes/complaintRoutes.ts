import express from 'express';
import { param } from 'express-validator';
import * as complaintController from '../controllers/complaintController';
import validate from '../middlewares/validate';
import upload, { validateUploadedFileSignatures } from '../middlewares/upload';
import { authenticate, authorizePermission, authorizePermissionForBodyValue } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { createComplaintValidation, listComplaintsValidation, complaintIdParamValidation, updateStatusValidation, assignmentValidation, escalateComplaintValidation } from '../validations/complaintValidation';

/** Target statuses that additionally require `complaints.close` (closing only; rejection is unchanged). */
const CLOSED_TARGET_STATUSES = ['closed'] as const;

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.post('/', authorizePermission('complaints.create'), upload.array('attachments', 3), validateUploadedFileSignatures, validate(createComplaintValidation), complaintController.createStaffComplaint);
router.get('/', authorizePermission('complaints.view_all'), validate(listComplaintsValidation), complaintController.listComplaints);
router.get(
  '/:complaintId/attachments/:attachmentId',
  authorizePermission('complaints.view_all'),
  validate([
    param('complaintId').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح'),
    param('attachmentId').isInt({ min: 1 }).withMessage('معرّف المرفق غير صالح'),
  ]),
  complaintController.downloadComplaintAttachment
);
router.get('/:id/transitions', authorizePermission('complaints.assign'), validate(complaintIdParamValidation), complaintController.listComplaintTransitions);
router.get('/:id', authorizePermission('complaints.view_all'), validate(complaintIdParamValidation), complaintController.getComplaint);
// Closing requires `complaints.close` in addition to the base `complaints.assign` permission;
// rejection transitions remain governed by `complaints.assign` alone.
router.patch(
  '/:id/status',
  authorizePermission('complaints.assign'),
  authorizePermissionForBodyValue('status', CLOSED_TARGET_STATUSES, 'complaints.close'),
  validate(updateStatusValidation),
  complaintController.updateComplaintStatus
);
router.patch('/:id/assignment', authorizePermission('complaints.assign'), validate(assignmentValidation), complaintController.assignComplaint);
router.post('/:id/escalate', authorizePermission('complaints.escalate'), validate(escalateComplaintValidation), complaintController.escalateComplaint);
router.post('/:id/regenerate-pin', authorizePermission('complaints.assign'), validate(complaintIdParamValidation), complaintController.regenerateTrackingPin);

export default router;
