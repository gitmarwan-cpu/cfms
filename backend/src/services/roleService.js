'use strict';

const { Op } = require('sequelize');
const { Role, Permission, UserRole } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * أدوار المؤسسة الفعّالة = الأدوار النظامية (organization_id = NULL، متاحة
 * للجميع) + الأدوار المخصّصة التي أنشأتها هذه المؤسسة تحديداً فقط.
 */
const listRoles = async (organizationId) => {
  return Role.findAll({
    where: { [Op.or]: [{ organizationId: null }, { organizationId }] },
    include: [{ model: Permission, as: 'permissions', attributes: ['id', 'code', 'module', 'descriptionAr'] }],
    order: [['id', 'ASC']],
  });
};

/**
 * يجلب دوراً بشرط أن يكون إما نظامياً أو مملوكاً لهذه المؤسسة تحديداً -
 * يمنع مؤسسة من الوصول لتفاصيل دور مخصّص أنشأته مؤسسة أخرى.
 */
const getRoleById = async (organizationId, id) => {
  const role = await Role.findOne({
    where: { id, [Op.or]: [{ organizationId: null }, { organizationId }] },
    include: [{ model: Permission, as: 'permissions', attributes: ['id', 'code', 'module', 'descriptionAr'] }],
  });
  if (!role) throw new ApiError(404, 'الدور غير موجود');
  return role;
};

const createRole = async (organizationId, { code, nameAr, nameEn, description, permissionIds }) => {
  const existing = await Role.findOne({ where: { code, organizationId } });
  if (existing) throw new ApiError(409, 'يوجد دور بنفس الكود مسبقاً في مؤسستك');

  const role = await Role.create({ code, nameAr, nameEn, description, isSystem: false, organizationId });

  if (Array.isArray(permissionIds) && permissionIds.length) {
    await role.setPermissions(permissionIds);
  }

  return getRoleById(organizationId, role.id);
};

const updateRole = async (organizationId, id, { nameAr, nameEn, description, isActive, permissionIds }) => {
  const role = await Role.findByPk(id);
  if (!role) throw new ApiError(404, 'الدور غير موجود');
  if (role.isSystem || role.organizationId !== organizationId) {
    // منع تعديل الأدوار النظامية (admin/staff) أو أدوار مؤسسة أخرى
    throw new ApiError(403, 'لا يمكن تعديل هذا الدور');
  }

  if (nameAr !== undefined) role.nameAr = nameAr;
  if (nameEn !== undefined) role.nameEn = nameEn;
  if (description !== undefined) role.description = description;
  if (isActive !== undefined) role.isActive = isActive;
  await role.save();

  if (Array.isArray(permissionIds)) {
    await role.setPermissions(permissionIds);
  }

  return getRoleById(organizationId, role.id);
};

const deleteRole = async (organizationId, id) => {
  const role = await Role.findByPk(id);
  if (!role) throw new ApiError(404, 'الدور غير موجود');
  if (role.isSystem || role.organizationId !== organizationId) {
    throw new ApiError(403, 'لا يمكن حذف هذا الدور');
  }

  const assignmentsCount = await UserRole.count({ where: { roleId: id } });
  if (assignmentsCount > 0) {
    throw new ApiError(400, 'لا يمكن حذف دور مُسنَد حالياً لمستخدمين؛ ألغِ التعيينات أولاً');
  }

  await role.destroy();
};

const listPermissions = async () => {
  // كتالوج الصلاحيات نظامي بالكامل (مشترك بين كل المؤسسات دوماً)
  return Permission.findAll({ order: [['module', 'ASC'], ['code', 'ASC']] });
};

module.exports = { listRoles, getRoleById, createRole, updateRole, deleteRole, listPermissions };
