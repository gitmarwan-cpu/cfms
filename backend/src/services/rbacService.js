'use strict';

const { UserRole, UserGroup, Role, Group, Permission, Organization } = require('../models');

/**
 * ============================================================
 * مصدرا الصلاحية الفعّالة (يعملان بالتوازي، بلا تعارض):
 * 1) مباشر: User → UserRole → Role → Permission
 * 2) عبر مجموعة: User → UserGroup → Group → GroupRole → Role → Permission
 * ============================================================
 * كلاهما يُدمَجان في نتيجة واحدة نهائية. لا يوجد أي مسار "أساسي" يُلغي
 * الآخر - كلاهما مصدر شرعي متساوٍ للصلاحية الفعلية.
 */

const getUserRoleAssignments = async (userId) => {
  return UserRole.findAll({
    where: { userId },
    include: [
      {
        model: Role,
        as: 'role',
        where: { isActive: true },
        include: [{ model: Permission, as: 'permissions', attributes: ['code'] }],
      },
      { model: Organization, as: 'organization', attributes: ['id', 'shortName'] },
    ],
  });
};

/**
 * يحمّل الأدوار المكتسبة عبر عضوية المستخدم في مجموعات (وليس عبر تعيين
 * مباشر). كل عضوية مجموعة لها organizationId خاص بها (لا orgUnitId على
 * مستوى المجموعة في هذه النسخة - النطاق الأدق بوحدة تنظيمية يبقى حصراً
 * عبر user_roles المباشر).
 */
const getUserGroupRoleAssignments = async (userId) => {
  const userGroups = await UserGroup.findAll({
    where: { userId },
    include: [
      {
        model: Group,
        as: 'group',
        where: { isActive: true },
        include: [
          {
            model: Role,
            as: 'roles',
            where: { isActive: true },
            required: false,
            include: [{ model: Permission, as: 'permissions', attributes: ['code'] }],
          },
        ],
      },
    ],
  });

  // يُعاد بنفس شكل getUserRoleAssignments (role + organizationId + orgUnitId=null)
  // ليسهل دمج المصدرين في مكان واحد دون تفريع منطق منفصل لكل استهلاك.
  const flattened = [];
  userGroups.forEach((userGroup) => {
    (userGroup.group.roles || []).forEach((role) => {
      flattened.push({ role, organizationId: userGroup.organizationId, orgUnitId: null });
    });
  });
  return flattened;
};

const getEffectiveRoleCodes = async (userId) => {
  const [directAssignments, groupAssignments] = await Promise.all([
    getUserRoleAssignments(userId),
    getUserGroupRoleAssignments(userId),
  ]);
  const codes = [...directAssignments.map((a) => a.role.code), ...groupAssignments.map((a) => a.role.code)];
  return [...new Set(codes)];
};

const getEffectivePermissions = async (userId) => {
  const [directAssignments, groupAssignments] = await Promise.all([
    getUserRoleAssignments(userId),
    getUserGroupRoleAssignments(userId),
  ]);

  const permissions = [];
  [...directAssignments, ...groupAssignments].forEach((assignment) => {
    (assignment.role.permissions || []).forEach((p) => {
      permissions.push({ code: p.code, organizationId: assignment.organizationId, orgUnitId: assignment.orgUnitId });
    });
  });
  return permissions;
};

const userHasPermission = async (userId, permissionCode, orgUnitId = null) => {
  const permissions = await getEffectivePermissions(userId);
  return permissions.some((p) => {
    if (p.code !== permissionCode) return false;
    if (orgUnitId == null) return true;
    return p.orgUnitId == null || p.orgUnitId === orgUnitId;
  });
};

module.exports = {
  getUserRoleAssignments,
  getUserGroupRoleAssignments,
  getEffectiveRoleCodes,
  getEffectivePermissions,
  userHasPermission,
};
