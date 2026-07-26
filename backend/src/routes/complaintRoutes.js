'use strict';

const express = require('express');
const complaintController = require('../controllers/complaintController');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { resolveAuthenticatedTenant } = require('../middlewares/tenant');
const {
  createComplaintValidation,
  listComplaintsValidation,
  complaintIdParamValidation,
  updateStatusValidation,
} = require('../validations/complaintValidation');

const router = express.Router();

// المسار العام (تقديم/متابعة بلا مصادقة) انتقل إلى:
// POST /api/public/:orgSlug/complaints
// POST /api/public/:orgSlug/complaints/track

router.use(authenticate, resolveAuthenticatedTenant);

/**
 * POST /api/complaints
 * تسجيل شكوى نيابة عن مستفيد من قبل موظف (حالة حضورية/هاتفية) - يُسجَّل
 * createdByUserId تلقائياً من الموظف المصادَق عليه، وليس أي قيمة من body.
 */
router.post(
  '/',
  authorizePermission('complaints.create'),
  upload.array('attachments', 3),
  validate(createComplaintValidation),
  complaintController.createStaffComplaint
);

router.get(
  '/',
  authorizePermission('complaints.view_all'),
  validate(listComplaintsValidation),
  complaintController.listComplaints
);

router.get(
  '/:id',
  authorizePermission('complaints.view_all'),
  validate(complaintIdParamValidation),
  complaintController.getComplaint
);

router.patch(
  '/:id/status',
  authorizePermission('complaints.assign'),
  validate(updateStatusValidation),
  complaintController.updateComplaintStatus
);

module.exports = router;
