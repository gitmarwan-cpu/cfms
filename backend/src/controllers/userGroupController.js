'use strict';

const catchAsync = require('../utils/catchAsync');
const userGroupService = require('../services/userGroupService');

const listUserGroups = catchAsync(async (req, res) => {
  const userGroups = await userGroupService.listUserGroups(req.organizationId, req.params.userId);
  res.status(200).json({ success: true, data: userGroups });
});

const addUserToGroup = catchAsync(async (req, res) => {
  const userGroup = await userGroupService.addUserToGroup(req.organizationId, {
    userId: req.params.userId,
    groupId: req.body.groupId,
  });
  res.status(201).json({ success: true, message: 'تمت إضافة المستخدم للمجموعة بنجاح', data: userGroup });
});

const removeUserFromGroup = catchAsync(async (req, res) => {
  await userGroupService.removeUserFromGroup(req.organizationId, req.params.userGroupId);
  res.status(200).json({ success: true, message: 'تمت إزالة المستخدم من المجموعة' });
});

module.exports = { listUserGroups, addUserToGroup, removeUserFromGroup };
