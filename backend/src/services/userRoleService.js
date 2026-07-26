'use strict';

const { Op } = require('sequelize');
const { UserRole, Role, User, OrgUnit, Organization, UserOrganization } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * تنبيه أمني (تمت معالجته): كانت listUserRoles وrevokeRole سابقاً بلا أي
 * تحقق من المؤسسة إطلاقاً - أي موظف admin في أي مؤسسة كان يستطيع نظرياً
 * إلغاء تعيين دور مستخدم في مؤسسة أخرى بتخمين userRoleId. الآن organizationId
 * (من resolveAuthenticatedTenant) إلزامي في كل دالة، ويُتحقق أن السجل
 * المستهدف يخص هذه المؤسسة فعلاً قبل أي قراءة أو تعديل.
 */

const listUserRoles = async (organizationId, userId) => {
  const membership = await UserOrganization.findOne({ where: { userId, organizationId } });
  if (!membership) throw new ApiError(404, 'المستخدم غير موجود ضمن مؤسستك');

  return UserRole.findAll({
    where: { userId, organizationId },
    include: [
      { model: Role, as: 'role', attributes: ['id', 'code', 'nameAr', 'nameEn'] },
      { model: OrgUnit, as: 'orgUnit', attributes: ['id', 'name', 'code'] },
    ],
  });
};

/**
 * يُسند دوراً لمستخدم ضمن مؤسسة المُنفِّذ الحالية (organizationId من سياق
 * المصادقة حصراً، وليس من body)، مع نطاق اختياري أدق بوحدة تنظيمية.
 */
const assignRole = async (organizationId, { userId, roleId, orgUnitId }) => {
  const [user, role] = await Promise.all([
    User.findByPk(userId),
    // الدور يجب أن يكون إما نظامياً (متاح للجميع) أو مملوكاً لهذه المؤسسة
    // تحديداً - يمنع استعارة دور مخصّص أنشأته مؤسسة أخرى.
    Role.findOne({ where: { id: roleId, [Op.or]: [{ organizationId: null }, { organizationId }] } }),
  ]);
  if (!user) throw new ApiError(404, 'المستخدم غير موجود');
  if (!role || !role.isActive) throw new ApiError(404, 'الدور غير موجود أو غير مفعّل ضمن مؤسستك');

  const membership = await UserOrganization.findOne({
    where: { userId, organizationId, isActive: true },
  });
  if (!membership) {
    throw new ApiError(400, 'لا يمكن إسناد دور لمستخدم غير عضو في هذه المؤسسة؛ أضِفه كعضو أولاً');
  }

  if (orgUnitId) {
    const orgUnit = await OrgUnit.findOne({ where: { id: orgUnitId, organizationId } });
    if (!orgUnit) throw new ApiError(404, 'الوحدة التنظيمية غير موجودة ضمن مؤسستك');
  }

  const existing = await UserRole.findOne({
    where: { userId, roleId, organizationId, orgUnitId: orgUnitId || null },
  });
  if (existing) throw new ApiError(409, 'هذا التعيين موجود بالفعل');

  return UserRole.create({ userId, roleId, organizationId, orgUnitId: orgUnitId || null });
};

const revokeRole = async (organizationId, userRoleId) => {
  const userRole = await UserRole.findOne({ where: { id: userRoleId, organizationId } });
  if (!userRole) throw new ApiError(404, 'تعيين الدور غير موجود ضمن مؤسستك');

  // منع إزالة آخر admin في هذه المؤسسة تحديداً (وليس عالمياً عبر كل
  // المؤسسات، بعد اعتماد النطاق التنظيمي الصريح لكل تعيين).
  const role = await Role.findByPk(userRole.roleId);
  if (role?.code === 'admin') {
    const remainingOrgAdmins = await UserRole.count({
      where: { roleId: userRole.roleId, organizationId },
      include: [{ model: Role, as: 'role', where: { code: 'admin' } }],
    });
    if (remainingOrgAdmins <= 1) {
      throw new ApiError(400, 'لا يمكن إلغاء آخر مدير في هذه المؤسسة');
    }
  }

  await userRole.destroy();
};

module.exports = { listUserRoles, assignRole, revokeRole };
