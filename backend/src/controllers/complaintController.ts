import type { AppRequest, AppResponse } from '../types/http';
import type { AppNext } from '../types/http';
import type { Response } from 'express';

import catchAsync from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import * as complaintService from '../services/complaintService';
import * as slaService from '../services/slaService';

/**
 * Derives the complaint read scope of the authenticated caller from trusted RBAC data
 * (effective permissions for the active organization + the authenticated user id).
 * Query/body/params/headers are never consulted for scope.
 */
const resolveComplaintVisibility = (req: AppRequest) =>
  complaintService.resolveComplaintVisibility({
    organizationId: req.organizationId,
    userId: req.user?.id ?? null,
    permissions: req.user?.permissions,
  });

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
  const result = await complaintService.listComplaints(req.organizationId, req.query, resolveComplaintVisibility(req));
  res.status(200).json({ success: true, ...result });
});

const getComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const complaint = await complaintService.getComplaintById(
    req.organizationId,
    req.params.id,
    resolveComplaintVisibility(req)
  );
  res.status(200).json({ success: true, data: complaint });
});

const downloadComplaintAttachment = catchAsync(async (req: AppRequest, res: Response, next: AppNext) => {
  const attachment = await complaintService.getComplaintAttachmentForDownload(
    req.organizationId,
    req.params.complaintId,
    req.params.attachmentId,
    resolveComplaintVisibility(req)
  );
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`);
  res.sendFile(attachment.filePath, (error) => {
    if (error && !res.headersSent) next(new ApiError(404, 'المرفق غير موجود'));
  });
});

const listComplaintTransitions = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const actorScope = complaintService.resolveComplaintActorScope(req.organizationId, req.user);
  const transitions = await complaintService.getComplaintTransitions(req.organizationId, req.params.id, actorScope);
  res.status(200).json({ success: true, data: transitions });
});

const updateComplaintStatus = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const { status, note } = req.body;
  const actorScope = complaintService.resolveComplaintActorScope(req.organizationId, req.user);
  const complaint = await complaintService.updateComplaintStatus(
    req.organizationId,
    req.params.id,
    status,
    note,
    req.user!.id,
    actorScope
  );
  res.status(200).json({ success: true, message: 'تم تحديث حالة الطلب', data: complaint });
});

const assignComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const actorScope = complaintService.resolveComplaintActorScope(req.organizationId, req.user);
  const complaint = await complaintService.assignComplaint(
    req.organizationId,
    req.params.id,
    {
      assigneeUserId: req.body.assigneeUserId,
      assigneeOrganizationId: req.body.assigneeOrganizationId,
      reason: req.body.reason,
    },
    req.user!.id,
    actorScope
  );
  res.status(200).json({ success: true, message: 'تم تحديث تعيين الشكوى', data: complaint });
});

const escalateComplaint = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const actorScope = complaintService.resolveComplaintActorScope(req.organizationId, req.user);
  await slaService.escalateComplaint(
    req.organizationId,
    req.params.id,
    { note: req.body.note },
    req.user!.id,
    actorScope
  );
  const complaint = await complaintService.getComplaintById(req.organizationId, req.params.id);
  res.status(200).json({ success: true, message: 'تم تصعيد الشكوى', data: complaint });
});

const regenerateTrackingPin = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const actorScope = complaintService.resolveComplaintActorScope(req.organizationId, req.user);
  const result = await complaintService.regenerateTrackingPin(
    req.organizationId,
    req.params.id,
    req.user!.id,
    actorScope
  );
  res.status(200).json({ success: true, message: `تم إنشاء رمز متابعة جديد وإرساله عبر ${result.channel}`, data: result });
});

export { submitPublicComplaint, trackPublicComplaint, createStaffComplaint, listComplaints, getComplaint, downloadComplaintAttachment, listComplaintTransitions, updateComplaintStatus, assignComplaint, escalateComplaint, regenerateTrackingPin };
