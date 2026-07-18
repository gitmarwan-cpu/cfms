'use strict';

const express = require('express');
const complaintController = require('../controllers/complaintController');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  createComplaintValidation,
  listComplaintsValidation,
  complaintIdParamValidation,
  updateStatusValidation,
} = require('../validations/complaintValidation');

const router = express.Router();

/**
 * POST /api/complaints
 * مسار عام (بدون مصادقة) لتقديم شكوى أو مقترح من قبل أي مستفيد،
 * يدعم إرفاق حتى 3 ملفات (صور/PDF).
 */
router.post(
  '/',
  upload.array('attachments', 3),
  validate(createComplaintValidation),
  complaintController.createComplaint
);

/**
 * GET /api/complaints
 * مسار محمي (staff/admin فقط) لعرض قائمة الشكاوى مع فلاتر وترقيم صفحات
 */
router.get(
  '/',
  authenticate,
  authorize('admin', 'staff'),
  validate(listComplaintsValidation),
  complaintController.listComplaints
);

/**
 * GET /api/complaints/:id
 * مسار محمي لعرض تفاصيل شكوى واحدة
 */
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'staff'),
  validate(complaintIdParamValidation),
  complaintController.getComplaint
);

/**
 * PATCH /api/complaints/:id/status
 * مسار محمي لتحديث حالة الشكوى (قيد المراجعة/تم الحل/مغلقة...)
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin', 'staff'),
  validate(updateStatusValidation),
  complaintController.updateComplaintStatus
);

module.exports = router;
