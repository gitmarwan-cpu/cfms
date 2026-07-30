'use strict';

const { Op } = require('sequelize');
const { Group, Role, UserGroup } = require('../models');
const ApiError = require('../utils/ApiError');

const listGroups = async (organizationId) => {
  return Group.findAll({
    where: { [Op.or]: [{ organizationId: null }, { organizationId }] },
    include: [{ model: Role, as: 'roles', attributes: ['id', 'code', 'nameAr', 'nameEn'] }],
    order: [['id', 'ASC']],
  });
};

const getGroupById = async (organizationId, id) => {
  const group = await Group.findOne({
    where: { id, [Op.or]: [{ organizationId: null }, { organizationId }] },
    include: [{ model: Role, as: 'roles', attributes: ['id', 'code', 'nameAr', 'nameEn'] }],
  });
  if (!group) throw new ApiError(404, 'المجموعة غير موجودة');
  return group;
};

const createGroup = async (organizationId, { code, nameAr, nameEn, description, roleIds }) => {
  const existing = await Group.findOne({ where: { code, organizationId } });
  if (existing) throw new ApiError(409, 'يوجد مجموعة بنفس الكود مسبقاً في مؤسستك');

  const group = await Group.create({ code, nameAr, nameEn, description, isSystem: false, organizationId });

  if (Array.isArray(roleIds) && roleIds.length) {
    await assignRolesToGroup(organizationId, group.id, roleIds);
  }

  return getGroupById(organizationId, group.id);
};

const updateGroup = async (organizationId, id, { nameAr, nameEn, description, isActive, roleIds }) => {
  const group = await Group.findByPk(id);
  if (!group || (group.organizationId !== null && group.organizationId !== organizationId)) {
    throw new ApiError(404, 'المجموعة غير موجودة');
  }
  if (group.isSystem) {
    throw new ApiError(403, 'لا يمكن تعديل المجموعات النظامية');
  }

  if (nameAr !== undefined) group.nameAr = nameAr;
  if (nameEn !== undefined) group.nameEn = nameEn;
  if (description !== undefined) group.description = description;
  if (isActive !== undefined) group.isActive = isActive;
  await group.save();

  if (Array.isArray(roleIds)) {
    await assignRolesToGroup(organizationId, group.id, roleIds);
  }

  return getGroupById(organizationId, group.id);
};

const deleteGroup = async (organizationId, id) => {
  const group = await Group.findByPk(id);
  if (!group || (group.organizationId !== null && group.organizationId !== organizationId)) {
    throw new ApiError(404, 'المجموعة غير موجودة');
  }
  if (group.isSystem) {
    throw new ApiError(403, 'لا يمكن حذف المجموعات النظامية');
  }

  const membersCount = await UserGroup.count({ where: { groupId: id } });
  if (membersCount > 0) {
    throw new ApiError(400, 'لا يمكن حذف مجموعة بها أعضاء حالياً؛ أزل الأعضاء أولاً');
  }

  await group.destroy();
};

/**
 * يستبدل قائمة الأدوار الكاملة لمجموعة معينة. كل دور يجب أن يكون نظامياً
 * أو مملوكاً لنفس المؤسسة (نفس قاعدة userRoleService.assignRole - لا
 * استعارة دور مؤسسة أخرى عبر مجموعة).
 */
const assignRolesToGroup = async (organizationId, groupId, roleIds) => {
  const group = await Group.findByPk(groupId);
  if (!group || (group.organizationId !== null && group.organizationId !== organizationId)) {
    throw new ApiError(404, 'المجموعة غير موجودة');
  }

  if (roleIds.length > 0) {
    const validRoles = await Role.findAll({
      where: { id: roleIds, [Op.or]: [{ organizationId: null }, { organizationId }] },
    });
    if (validRoles.length !== roleIds.length) {
      throw new ApiError(422, 'أحد الأدوار المحددة غير موجود أو لا يخص مؤسستك');
    }
  }

  await group.setRoles(roleIds);
  return getGroupById(organizationId, groupId);
};

module.exports = { listGroups, getGroupById, createGroup, updateGroup, deleteGroup, assignRolesToGroup };
