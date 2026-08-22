import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';

export type OrganizationId = string | number;
export type UserId = string | number;
export type GroupId = string | number;
export type UserGroupId = string | number;

const toSafeInteger = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const USER_GROUP_SELECT = {
  id: true,
  user_id: true,
  group_id: true,
  organization_id: true,
  created_at: true,
  updated_at: true,
  groups: { select: { id: true, code: true, name_ar: true, name_en: true } },
} as const;

const mapUserGroup = (entry: any) => ({
  id: entry.id,
  userId: entry.user_id,
  groupId: entry.group_id,
  organizationId: entry.organization_id,
  createdAt: entry.created_at,
  updatedAt: entry.updated_at,
  group: {
    id: entry.groups.id,
    code: entry.groups.code,
    nameAr: entry.groups.name_ar,
    nameEn: entry.groups.name_en,
  },
});

export const listUserGroups = async (organizationId: OrganizationId, userId: UserId) => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserId = toSafeInteger(userId);
  const membership = parsedOrganizationId && parsedUserId
    ? await prisma.user_organizations.findFirst({ where: { user_id: parsedUserId, organization_id: parsedOrganizationId } })
    : null;
  if (!membership) throw new ApiError(404, 'المستخدم غير موجود ضمن مؤسستك');

  const entries = await prisma.user_groups.findMany({
    where: { user_id: parsedUserId as number, organization_id: parsedOrganizationId as number },
    select: USER_GROUP_SELECT,
  });
  return entries.map(mapUserGroup);
};

export const addUserToGroup = async (
  organizationId: OrganizationId,
  payload: { userId: UserId; groupId: GroupId },
  actorUserId?: string | number | null
) => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserId = toSafeInteger(payload.userId);
  const parsedGroupId = toSafeInteger(payload.groupId);
  const [user, group] = parsedUserId && parsedGroupId
    ? await Promise.all([
        prisma.users.findUnique({ where: { id: parsedUserId }, select: { id: true } }),
        prisma.groups.findFirst({
          where: { id: parsedGroupId, OR: [{ organization_id: null }, { organization_id: parsedOrganizationId as number }] },
          select: { id: true, is_active: true },
        }),
      ])
    : [null, null];
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  if (!group || !group.is_active) throw new ApiError(404, 'المجموعة غير موجودة أو غير مفعّلة ضمن مؤسستك');

  const orgMembership = await prisma.user_organizations.findFirst({
    where: { user_id: parsedUserId as number, organization_id: parsedOrganizationId as number, is_active: true },
  });
  if (!orgMembership) throw new ApiError(400, 'لا يمكن إضافة مستخدم غير عضو في هذه المؤسسة لمجموعة تابعة لها');

  const existing = await prisma.user_groups.findFirst({
    where: { user_id: parsedUserId as number, group_id: parsedGroupId as number, organization_id: parsedOrganizationId as number },
  });
  if (existing) throw new ApiError(409, 'المستخدم منضم لهذه المجموعة بالفعل');

  const created = await prisma.user_groups.create({
    data: {
      user_id: parsedUserId as number,
      group_id: parsedGroupId as number,
      organization_id: parsedOrganizationId as number,
      created_at: new Date(),
      updated_at: new Date(),
    },
    select: USER_GROUP_SELECT,
  });
  await recordAuditEvent(prisma, {
    organizationId: parsedOrganizationId,
    actorUserId: toSafeInteger(actorUserId),
    action: 'user.group_added',
    entityType: 'user',
    entityId: parsedUserId,
    metadata: { groupId: parsedGroupId },
  });
  return mapUserGroup(created);
};

export const removeUserFromGroup = async (
  organizationId: OrganizationId,
  userGroupId: UserGroupId,
  actorUserId?: string | number | null
): Promise<void> => {
  const parsedOrganizationId = toSafeInteger(organizationId);
  const parsedUserGroupId = toSafeInteger(userGroupId);
  const userGroup = parsedOrganizationId && parsedUserGroupId
    ? await prisma.user_groups.findFirst({
        where: { id: parsedUserGroupId, organization_id: parsedOrganizationId },
        select: { id: true, user_id: true, group_id: true },
      })
    : null;
  if (!userGroup) throw new ApiError(404, 'عضوية المجموعة غير موجودة ضمن مؤسستك');
  await prisma.user_groups.delete({ where: { id: parsedUserGroupId as number } });
  await recordAuditEvent(prisma, {
    organizationId: parsedOrganizationId,
    actorUserId: toSafeInteger(actorUserId),
    action: 'user.group_removed',
    entityType: 'user',
    entityId: userGroup.user_id,
    metadata: { groupId: userGroup.group_id },
  });
};

