import type { AppRequest, AppResponse } from '../types/http';

import catchAsync from '../utils/catchAsync';
import * as platformUserService from '../services/platformUserService';
import * as platformMembershipService from '../services/platformMembershipService';
import * as platformMembershipDiscoveryService from '../services/platformMembershipDiscoveryService';
const listUsers = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await platformUserService.listUsers({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    isActive: req.query.isActive,
  });
  res.status(200).json({ success: true, ...result });
});

const listMembershipUserOptions = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await platformUserService.listMembershipUserOptions({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
  });
  res.status(200).json({ success: true, ...result });
});

const getUserById = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const includeMembershipDetails = req.user?.platformPermissions?.includes('platform.memberships.manage') ?? false;
  res.status(200).json({
    success: true,
    data: await platformUserService.getUserById(req.params.userId, { includeMembershipDetails }),
  });
});

const createUser = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await platformUserService.createUser(req.body, req.user!.id);
  res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: user });
});

const deactivateUser = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await platformUserService.deactivateUser(req.params.userId, req.user!.id);
  res.status(200).json({ success: true, message: 'تم إلغاء تفعيل المستخدم بنجاح', data: user });
});

const activateUser = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const user = await platformUserService.activateUser(req.params.userId, req.user!.id);
  res.status(200).json({ success: true, message: 'تم تفعيل المستخدم بنجاح', data: user });
});

const listTenantMemberships = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const result = await platformMembershipDiscoveryService.listTenantMemberships(req.params.organizationId, {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
  });
  res.status(200).json({ success: true, ...result });
});

const listTenantRoles = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const data = await platformMembershipDiscoveryService.listTenantRoles(req.params.organizationId);
  res.status(200).json({ success: true, data });
});

const listTenantOrganizationNodes = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const data = await platformMembershipDiscoveryService.listTenantOrganizationNodes(req.params.organizationId);
  res.status(200).json({ success: true, data });
});

const addMembership = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const membership = await platformMembershipService.addMembership(req.params.organizationId, req.params.userId, req.user!.id);
  res.status(201).json({ success: true, message: 'تمت إضافة العضوية بنجاح', data: membership });
});

const removeMembership = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const membership = await platformMembershipService.removeMembership(req.params.organizationId, req.params.userId, req.user!.id);
  res.status(200).json({ success: true, message: 'تم إلغاء العضوية بنجاح', data: membership });
});

const setPrimaryMembership = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const membership = await platformMembershipService.setPrimaryMembership(req.params.organizationId, req.params.userId, req.user!.id);
  res.status(200).json({ success: true, message: 'تم تعيين العضوية الأساسية بنجاح', data: membership });
});

const assignRole = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const role = await platformMembershipService.assignRole(
    req.params.organizationId,
    req.params.userId,
    { roleId: req.body.roleId, organizationNodeId: req.body.organizationNodeId },
    req.user!.id
  );
  res.status(201).json({ success: true, message: 'تم إسناد الدور بنجاح', data: role });
});

const changeRole = catchAsync(async (req: AppRequest, res: AppResponse) => {
  const role = await platformMembershipService.changeRole(
    req.params.organizationId,
    req.params.userId,
    req.params.userRoleId,
    { roleId: req.body.roleId, organizationNodeId: req.body.organizationNodeId },
    req.user!.id
  );
  res.status(200).json({ success: true, message: 'تم تغيير الدور بنجاح', data: role });
});

export {
  listUsers,
  listMembershipUserOptions,
  getUserById,
  createUser,
  deactivateUser,
  activateUser,
  listTenantMemberships,
  listTenantRoles,
  listTenantOrganizationNodes,
  addMembership,
  removeMembership,
  setPrimaryMembership,
  assignRole,
  changeRole,
};
