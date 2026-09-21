import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { assertActiveTenant } from './tenantLifecycleService';
import * as membershipService from './membershipService';
import * as userRoleService from './userRoleService';

const toPositiveInteger = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseIds = (organizationId: unknown, userId: unknown) => {
  const parsedOrganizationId = toPositiveInteger(organizationId);
  const parsedUserId = toPositiveInteger(userId);
  if (!parsedOrganizationId) throw new ApiError(422, 'معرّف المؤسسة غير صالح');
  if (!parsedUserId) throw new ApiError(422, 'معرّف المستخدم غير صالح');
  return { parsedOrganizationId, parsedUserId };
};

const getMembershipId = async (organizationId: number, userId: number, activeOnly = false) => {
  const membership = await prisma.user_organizations.findFirst({
    where: { organization_id: organizationId, user_id: userId, ...(activeOnly ? { is_active: true } : {}) },
    select: { id: true },
  });
  if (!membership) throw new ApiError(404, 'العضوية غير موجودة ضمن المؤسسة');
  return membership.id;
};

export const addMembership = async (organizationId: unknown, userId: unknown, actorUserId: number) => {
  const ids = parseIds(organizationId, userId);
  await assertActiveTenant(ids.parsedOrganizationId);
  return membershipService.addMembership(ids.parsedOrganizationId, actorUserId, ids.parsedUserId);
};

export const removeMembership = async (organizationId: unknown, userId: unknown, actorUserId: number) => {
  const ids = parseIds(organizationId, userId);
  await assertActiveTenant(ids.parsedOrganizationId);
  const membershipId = await getMembershipId(ids.parsedOrganizationId, ids.parsedUserId, true);
  return membershipService.removeMembership(ids.parsedOrganizationId, actorUserId, membershipId);
};

export const setPrimaryMembership = async (organizationId: unknown, userId: unknown, actorUserId: number) => {
  const ids = parseIds(organizationId, userId);
  await assertActiveTenant(ids.parsedOrganizationId);
  const membershipId = await getMembershipId(ids.parsedOrganizationId, ids.parsedUserId, true);
  return membershipService.setPrimaryMembership(ids.parsedOrganizationId, actorUserId, membershipId);
};

export const assignRole = async (
  organizationId: unknown,
  userId: unknown,
  payload: { roleId: string | number; organizationNodeId?: string | number | null },
  actorUserId: number
) => {
  const ids = parseIds(organizationId, userId);
  await assertActiveTenant(ids.parsedOrganizationId);
  return userRoleService.assignRole(
    ids.parsedOrganizationId,
    { userId: ids.parsedUserId, roleId: payload.roleId, organizationNodeId: payload.organizationNodeId },
    actorUserId
  );
};

export const changeRole = async (
  organizationId: unknown,
  userId: unknown,
  userRoleId: unknown,
  payload: { roleId: string | number; organizationNodeId?: string | number | null },
  actorUserId: number
) => {
  const ids = parseIds(organizationId, userId);
  const parsedUserRoleId = toPositiveInteger(userRoleId);
  if (!parsedUserRoleId) throw new ApiError(422, 'معرّف تعيين الدور غير صالح');
  await assertActiveTenant(ids.parsedOrganizationId);
  return userRoleService.changeRole(
    ids.parsedOrganizationId,
    ids.parsedUserId,
    parsedUserRoleId,
    payload,
    actorUserId
  );
};
