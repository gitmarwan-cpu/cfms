'use strict';

const catchAsync = require('../utils/catchAsync');
const userRoleService = require('../services/userRoleService');

const listUserRoles = catchAsync(async (req, res) => {
  const userRoles = await userRoleService.listUserRoles(req.organizationId, req.params.userId);
  res.status(200).json({ success: true, data: userRoles });
});

const assignRole = catchAsync(async (req, res) => {
  const userRole = await userRoleService.assignRole(req.organizationId, {
    userId: req.params.userId,
    roleId: req.body.roleId,
    orgUnitId: req.body.orgUnitId,
  });
  res.status(201).json({ success: true, message: 'تم إسناد الدور بنجاح', data: userRole });
});

const revokeRole = catchAsync(async (req, res) => {
  await userRoleService.revokeRole(req.organizationId, req.params.userRoleId);
  res.status(200).json({ success: true, message: 'تم إلغاء تعيين الدور' });
});

module.exports = { listUserRoles, assignRole, revokeRole };
