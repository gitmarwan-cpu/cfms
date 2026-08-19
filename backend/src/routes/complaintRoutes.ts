const express = require('express');
const complaintController = require('../controllers/complaintController');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { validateUploadedFileSignatures } = require('../middlewares/upload');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const { createComplaintValidation, listComplaintsValidation, complaintIdParamValidation, updateStatusValidation, assignmentValidation, escalateComplaintValidation } = require('../validations/complaintValidation');
export {};

const router = express.Router();
router.use(authenticate, resolveAuthenticatedTenant);
router.post('/', authorizePermission('complaints.create'), upload.array('attachments', 3), validateUploadedFileSignatures, validate(createComplaintValidation), complaintController.createStaffComplaint);
router.get('/', authorizePermission('complaints.view_all'), validate(listComplaintsValidation), complaintController.listComplaints);
router.get('/:id', authorizePermission('complaints.view_all'), validate(complaintIdParamValidation), complaintController.getComplaint);
router.patch('/:id/status', authorizePermission('complaints.assign'), validate(updateStatusValidation), complaintController.updateComplaintStatus);
router.patch('/:id/assignment', authorizePermission('complaints.assign'), validate(assignmentValidation), complaintController.assignComplaint);
router.post('/:id/escalate', authorizePermission('complaints.escalate'), validate(escalateComplaintValidation), complaintController.escalateComplaint);

module.exports = router;
