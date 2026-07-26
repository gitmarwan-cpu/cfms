'use strict';

const { UserRole, Role, Permission, Organization } = require('../models');

/**
 * يحمّل جميع تعيينات الأدوار الفعّالة لمستخدم معيّن (مع صلاحيات كل دور).
 * هذه هي نقطة الحقيقة الوحيدة (single source of truth) لأي تحقق من
 * الصلاحيات في النظام - يُستخدمها middlewares/auth.js وauthService.js
 * لتفادي ازدواجية منطق القراءة من قاعدة البيانات.
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
 * يُرجع مصفوفة أكواد الأدوار الفعّالة للمستخدم (بدون تكرار)، بصرف النظر
 * عن النطاق (org_unit)، للتوافق مع الاستخدام القديم authorize('admin').
 */
const getEffectiveRoleCodes = async (userId) => {
  const assignments = await getUserRoleAssignments(userId);
  return [...new Set(assignments.map((a) => a.role.code))];
};

/**
 * يُرجع مصفوفة أكواد الصلاحيات الفعّالة للمستخدم عبر كل أدواره مجتمعة،
 * مع خريطة اختيارية بحسب نطاق الوحدة التنظيمية (org_unit_id) لدعم
 * التحقق المُقيَّد بنطاق لاحقاً (مثال: صلاحية على قسم معيّن فقط).
 */
const getEffectivePermissions = async (userId) => {
  const assignments = await getUserRoleAssignments(userId);
  const permissions = [];
  assignments.forEach((assignment) => {
    (assignment.role.permissions || []).forEach((p) => {
      permissions.push({ code: p.code, organizationId: assignment.organizationId, orgUnitId: assignment.orgUnitId });
    });
  });
  return permissions;
};

/**
 * يتحقق هل يملك المستخدم صلاحية معيّنة، اختيارياً ضمن نطاق وحدة تنظيمية
 * محددة. إن لم يُمرَّر orgUnitId، يُقبل أي تعيين (عام أو مُقيَّد) يحمل هذه الصلاحية.
 */
const userHasPermission = async (userId, permissionCode, orgUnitId = null) => {
  const permissions = await getEffectivePermissions(userId);
  return permissions.some((p) => {
    if (p.code !== permissionCode) return false;
    if (orgUnitId == null) return true;
    // نطاق عام (org_unit_id = null) يغطي كل الوحدات؛ وإلا يجب تطابق الوحدة تحديداً
    return p.orgUnitId == null || p.orgUnitId === orgUnitId;
  });
};

module.exports = {
  getUserRoleAssignments,
  getEffectiveRoleCodes,
  getEffectivePermissions,
  userHasPermission,
};
