'use strict';

const catchAsync = require('../utils/catchAsync');
const complaintService = require('../services/complaintService');

/**
 * ============ استخدام عام (بدون مصادقة، عبر publicRoutes.js) ============
 * req.organizationId يأتي من resolvePublicTenant (slug في الرابط) - لا
 * يُقرأ organizationId إطلاقاً من body حتى لو أرسله العميل.
 */

const submitPublicComplaint = catchAsync(async (req, res) => {
  const { complaint, trackingPin } = await complaintService.createComplaint(
    req.organizationId,
    req.body,
    req.files
  );
  res.status(201).json({
    success: true,
    message: 'تم استلام طلبك بنجاح. احتفظ بالرقم المرجعي ورمز المتابعة لمتابعة حالة طلبك.',
    data: {
      id: complaint.id,
      referenceCode: complaint.referenceCode,
      trackingPin, // يُعرض مرة واحدة فقط هنا؛ لا يُخزَّن ولا يمكن استرجاعه لاحقاً
    },
  });
});

const trackPublicComplaint = catchAsync(async (req, res) => {
  const result = await complaintService.trackComplaint(req.organizationId, req.body.referenceCode, req.body.pin);
  res.status(200).json({ success: true, data: result });
});

/**
 * ============ استخدام إداري (موظف مصادَق عليه) ============
 * req.organizationId يأتي من resolveAuthenticatedTenant (عضوية فعلية
 * محقَّقة)، req.user.id لتسجيل من قام بالتغيير/الإدخال.
 */

const createStaffComplaint = catchAsync(async (req, res) => {
  const { complaint } = await complaintService.createComplaint(
    req.organizationId,
    req.body,
    req.files,
    req.user.id
  );
  res.status(201).json({ success: true, message: 'تم تسجيل الطلب بنجاح', data: complaint });
});

const listComplaints = catchAsync(async (req, res) => {
  const result = await complaintService.listComplaints(req.organizationId, req.query);
  res.status(200).json({ success: true, ...result });
});

const getComplaint = catchAsync(async (req, res) => {
  const complaint = await complaintService.getComplaintById(req.organizationId, req.params.id);
  res.status(200).json({ success: true, data: complaint });
});

const updateComplaintStatus = catchAsync(async (req, res) => {
  const { status, note } = req.body;
  const complaint = await complaintService.updateComplaintStatus(
    req.organizationId,
    req.params.id,
    status,
    note,
    req.user.id
  );
  res.status(200).json({ success: true, message: 'تم تحديث حالة الطلب', data: complaint });
});

module.exports = {
  submitPublicComplaint,
  trackPublicComplaint,
  createStaffComplaint,
  listComplaints,
  getComplaint,
  updateComplaintStatus,
};
