'use strict';

const catchAsync = require('../utils/catchAsync');
const complaintService = require('../services/complaintService');

const createComplaint = catchAsync(async (req, res) => {
  const complaint = await complaintService.createComplaint(req.body, req.files);
  res.status(201).json({
    success: true,
    message: 'تم استلام طلبك بنجاح',
    data: {
      referenceCode: complaint.referenceCode,
      complaint,
    },
  });
});

const listComplaints = catchAsync(async (req, res) => {
  const result = await complaintService.listComplaints(req.query);
  res.status(200).json({ success: true, ...result });
});

const getComplaint = catchAsync(async (req, res) => {
  const complaint = await complaintService.getComplaintById(req.params.id);
  res.status(200).json({ success: true, data: complaint });
});

const updateComplaintStatus = catchAsync(async (req, res) => {
  const { status, note } = req.body;
  const complaint = await complaintService.updateComplaintStatus(
    req.params.id,
    status,
    note,
    req.user.id
  );
  res.status(200).json({ success: true, message: 'تم تحديث حالة الطلب', data: complaint });
});

module.exports = { createComplaint, listComplaints, getComplaint, updateComplaintStatus };
