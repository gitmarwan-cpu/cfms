'use strict';

const { Op } = require('sequelize');
const { UserGroup, Group, User, UserOrganization } = require('../models');
const ApiError = require('../utils/ApiError');

const listUserGroups = async (organizationId, userId) => {
  const membership = await UserOrganization.findOne({ where: { userId, organizationId } });
  if (!membership) throw new ApiError(404, 'المستخدم غير موجود ضمن مؤسستك');

  return UserGroup.findAll({
    where: { userId, organizationId },
    include: [{ model: Group, as: 'group', attributes: ['id', 'code', 'nameAr', 'nameEn'] }],
  });
};

/**
 * يضيف مستخدماً لمجموعة ضمن مؤسسة المُنفِّذ الحالية حصراً. نفس قواعد
 * userRoleService.assignRole: المستخدم يجب أن يكون عضواً فعلياً في هذه
 * المؤسسة، والمجموعة يجب أن تكون نظامية أو مملوكة لنفس المؤسسة.
 */
const addUserToGroup = async (organizationId, { userId, groupId }) => {
  const [user, group] = await Promise.all([
    User.findByPk(userId),
    Group.findOne({ where: { id: groupId, [Op.or]: [{ organizationId: null }, { organizationId }] } }),
  ]);
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  if (!group || !group.isActive) throw new ApiError(404, 'المجموعة غير موجودة أو غير مفعّلة ضمن مؤسستك');

  const orgMembership = await UserOrganization.findOne({ where: { userId, organizationId, isActive: true } });
  if (!orgMembership) {
    throw new ApiError(400, 'لا يمكن إضافة مستخدم غير عضو في هذه المؤسسة لمجموعة تابعة لها');
  }

  const existing = await UserGroup.findOne({ where: { userId, groupId, organizationId } });
  if (existing) throw new ApiError(409, 'المستخدم منضم لهذه المجموعة بالفعل');

  return UserGroup.create({ userId, groupId, organizationId });
};

const removeUserFromGroup = async (organizationId, userGroupId) => {
  const userGroup = await UserGroup.findOne({ where: { id: userGroupId, organizationId } });
  if (!userGroup) throw new ApiError(404, 'عضوية المجموعة غير موجودة ضمن مؤسستك');

  await userGroup.destroy();
};

module.exports = { listUserGroups, addUserToGroup, removeUserFromGroup };
