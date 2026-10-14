import express from 'express';
import { param } from 'express-validator';
import * as complaintController from '../controllers/complaintController';
import validate from '../middlewares/validate';
import upload, { cleanupUploadedFilesOnError, validateUploadedFileSignatures } from '../middlewares/upload';
import { authenticate, authorizeAnyPermission, authorizePermission, authorizePermissionForBodyValue } from '../middlewares/auth';
import { resolveAuthenticatedTenant } from '../middlewares/tenant';
import { createComplaintValidation, listComplaintsValidation, complaintIdParamValidation, updateStatusValidation, assignmentValidation, escalateComplaintValidation } from '../validations/complaintValidation';

/** Target statuses that additionally require `complaints.close` (closing only; rejection is unchanged). */
const CLOSED_TARGET_STATUSES = ['closed'] as const;

/**
 * Complaint read access is granted by either the tenant-wide `complaints.view_all` or the
 * own/node-scoped `complaints.view_own`. The per-record data scope (organization node or
 * direct assignee) is NOT resolved here — it is enforced in the service layer from trusted
 * RBAC data only, so out-of-scope records behave exactly like non-existent ones (404).
 */
const COMPLAINT_READ_PERMISSIONS = ['complaints.view_all', 'complaints.view_own'] as const;

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.post('/', authorizePermission('complaints.create'), upload.array('attachments', 3), validateUploadedFileSignatures, validate(createComplaintValidation), complaintController.createStaffComplaint);
router.get('/', authorizeAnyPermission(...COMPLAINT_READ_PERMISSIONS), validate(listComplaintsValidation), complaintController.listComplaints);
router.get(
  '/:complaintId/attachments/:attachmentId',
  authorizeAnyPermission(...COMPLAINT_READ_PERMISSIONS),
  validate([
    param('complaintId').isInt({ min: 1 }).withMessage('معرّف الشكوى غير صالح'),
    param('attachmentId').isInt({ min: 1 }).withMessage('معرّف المرفق غير صالح'),
  ]),
  complaintController.downloadComplaintAttachment
);
router.get('/:id/transitions', authorizePermission('complaints.assign'), validate(complaintIdParamValidation), complaintController.listComplaintTransitions);
router.get('/:id', authorizeAnyPermission(...COMPLAINT_READ_PERMISSIONS), validate(complaintIdParamValidation), complaintController.getComplaint);
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
// Post-creation attachment upload (GAP-02 / PADR-02): caseworkers with assign or view_own may
// supplement an existing complaint with additional files. Tenant-filtered lookup plus explicit
// read-scope and node-aware assignment authorization are enforced in the service layer (never from request params).
router.post(
  '/:id/attachments',
  authorizeAnyPermission('complaints.assign', 'complaints.view_own'),
  upload.array('attachments', 3),
  validateUploadedFileSignatures,
  validate(complaintIdParamValidation),
  complaintController.addComplaintAttachments,
  cleanupUploadedFilesOnError
);

export default router;
