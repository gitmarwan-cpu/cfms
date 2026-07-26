'use strict';

const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role, UserRole, UserOrganization } = require('../models');
const ApiError = require('../utils/ApiError');
const rbacService = require('./rbacService');

const generateToken = async (user) => {
  const roleCodes = await rbacService.getEffectiveRoleCodes(user.id);
  return jwt.sign({ sub: user.id, roles: roleCodes }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
};

const login = async (email, password) => {
  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user || !user.isActive) {
    throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }

  const token = await generateToken(user);
  const { passwordHash, ...userSafe } = user.toJSON();
  const roleCodes = await rbacService.getEffectiveRoleCodes(user.id);

  return { token, user: { ...userSafe, roleCodes } };
};

/**
 * تسجيل مستخدم جديد (staff افتراضياً) ضمن مؤسسة المُنفِّذ الحالية حصراً
 * (organizationId من resolveAuthenticatedTenant، وليس من body الطلب) -
 * يُقيَّد عبر الراوت بحيث لا يستدعيه سوى مستخدم يملك صلاحية users.manage
 * ضمن نفس المؤسسة (راجع middlewares/auth.js -> authorizePermission).
 * roleCode: كود الدور المطلوب تعيينه (افتراضياً 'staff')، orgUnitId: نطاق
 * اختياري لربط المستخدم بوحدته التنظيمية منذ الإنشاء.
 */
const register = async (organizationId, { fullName, email, password, roleCode, orgUnitId }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'البريد الإلكتروني مستخدم بالفعل');
  }

  // الدور يجب أن يكون نظامياً أو مملوكاً لهذه المؤسسة تحديداً (نفس قاعدة
  // userRoleService.assignRole - يمنع استعارة دور مخصّص من مؤسسة أخرى).
  const role = await Role.findOne({
    where: { code: roleCode || 'staff', isActive: true, [Op.or]: [{ organizationId: null }, { organizationId }] },
  });
  if (!role) {
    throw new ApiError(400, 'الدور المحدد غير موجود أو غير مفعّل ضمن مؤسستك');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    orgUnitId: orgUnitId || null,
    defaultOrganizationId: organizationId,
  });

  await UserOrganization.create({ userId: user.id, organizationId, isPrimary: true, isActive: true });
  await UserRole.create({ userId: user.id, roleId: role.id, organizationId, orgUnitId: orgUnitId || null });

  return user;
};

module.exports = { login, register, generateToken };
