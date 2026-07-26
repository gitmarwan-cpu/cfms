'use strict';

const catchAsync = require('../utils/catchAsync');
const roleService = require('../services/roleService');

const listRoles = catchAsync(async (req, res) => {
  const roles = await roleService.listRoles(req.organizationId);
  res.status(200).json({ success: true, data: roles });
});

const getRole = catchAsync(async (req, res) => {
  const role = await roleService.getRoleById(req.organizationId, req.params.id);
  res.status(200).json({ success: true, data: role });
});

const createRole = catchAsync(async (req, res) => {
  const role = await roleService.createRole(req.organizationId, req.body);
  res.status(201).json({ success: true, message: 'تم إنشاء الدور بنجاح', data: role });
});

const updateRole = catchAsync(async (req, res) => {
  const role = await roleService.updateRole(req.organizationId, req.params.id, req.body);
  res.status(200).json({ success: true, message: 'تم تحديث الدور بنجاح', data: role });
});

const deleteRole = catchAsync(async (req, res) => {
  await roleService.deleteRole(req.organizationId, req.params.id);
  res.status(200).json({ success: true, message: 'تم حذف الدور بنجاح' });
});

const listPermissions = catchAsync(async (req, res) => {
  const permissions = await roleService.listPermissions();
  res.status(200).json({ success: true, data: permissions });
});

module.exports = { listRoles, getRole, createRole, updateRole, deleteRole, listPermissions };
