'use strict';

const catchAsync = require('../utils/catchAsync');
const groupService = require('../services/groupService');

const listGroups = catchAsync(async (req, res) => {
  const groups = await groupService.listGroups(req.organizationId);
  res.status(200).json({ success: true, data: groups });
});

const getGroup = catchAsync(async (req, res) => {
  const group = await groupService.getGroupById(req.organizationId, req.params.id);
  res.status(200).json({ success: true, data: group });
});

const createGroup = catchAsync(async (req, res) => {
  const group = await groupService.createGroup(req.organizationId, req.body);
  res.status(201).json({ success: true, message: 'تم إنشاء المجموعة بنجاح', data: group });
});

const updateGroup = catchAsync(async (req, res) => {
  const group = await groupService.updateGroup(req.organizationId, req.params.id, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث المجموعة بنجاح', data: group });
});

const deleteGroup = catchAsync(async (req, res) => {
  await groupService.deleteGroup(req.organizationId, req.params.id);
  res.status(200).json({ success: true, message: 'تم حذف المجموعة بنجاح' });
});

module.exports = { listGroups, getGroup, createGroup, updateGroup, deleteGroup };
