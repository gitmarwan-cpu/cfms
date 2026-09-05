import type { AppRequest, AppResponse } from '../types/http';

const catchAsync = require('../utils/catchAsync');
const complaintService = require('../services/complaintService');
const slaService = require('../services/slaService');
export {};

const submitPublicComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const { complaint, trackingPin } = await complaintService.createComplaint(req.organizationId, req.body, req.files);
  res.status(201).json({ success: true, message: 'تم استلام طلبك بنجاح. احتفظ بالرقم المرجعي ورمز المتابعة لمتابعة حالة طلبك.', data: { id: complaint.id, referenceCode: complaint.referenceCode, trackingPin } });
});

const trackPublicComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await complaintService.trackComplaint(req.organizationId, req.body.referenceCode, req.body.pin);
  res.status(200).json({ success: true, data: result });
});

const createStaffComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const { complaint } = await complaintService.createComplaint(req.organizationId, req.body, req.files, req.user!.id);
  res.status(201).json({ success: true, message: 'تم تسجيل الطلب بنجاح', data: complaint });
});

const listComplaints = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await complaintService.listComplaints(req.organizationId, req.query);
  res.status(200).json({ success: true, ...result });
});

const getComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const complaint = await complaintService.getComplaintById(req.organizationId, req.params.id);
  res.status(200).json({ success: true, data: complaint });
});

const listComplaintTransitions = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const transitions = await complaintService.getComplaintTransitions(req.organizationId, req.params.id);
  res.status(200).json({ success: true, data: transitions });
});

const updateComplaintStatus = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const { status, note } = req.body;
  const complaint = await complaintService.updateComplaintStatus(req.organizationId, req.params.id, status, note, req.user!.id);
  res.status(200).json({ success: true, message: 'تم تحديث حالة الطلب', data: complaint });
});

const assignComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const complaint = await complaintService.assignComplaint(
    req.organizationId,
    req.params.id,
    {
      assigneeUserId: req.body.assigneeUserId,
      assigneeOrganizationId: req.body.assigneeOrganizationId,
    },
    req.user!.id
  );
  res.status(200).json({ success: true, message: 'تم تحديث تعيين الشكوى', data: complaint });
});

const escalateComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  await slaService.escalateComplaint(req.organizationId, req.params.id, { note: req.body.note }, req.user!.id);
  const complaint = await complaintService.getComplaintById(req.organizationId, req.params.id);
  res.status(200).json({ success: true, message: 'تم تصعيد الشكوى', data: complaint });
});

const regenerateTrackingPin = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await complaintService.regenerateTrackingPin(req.organizationId, req.params.id, req.user!.id);
  res.status(200).json({ success: true, message: `تم إنشاء رمز متابعة جديد وإرساله عبر ${result.channel}`, data: result });
});

module.exports = { submitPublicComplaint, trackPublicComplaint, createStaffComplaint, listComplaints, getComplaint, listComplaintTransitions, updateComplaintStatus, assignComplaint, escalateComplaint, regenerateTrackingPin };
