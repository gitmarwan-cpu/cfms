'use strict';

const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { User } = require('../models');
const rbacService = require('../services/rbacService');

/**
 * يتحقق من وجود توكن JWT صالح في هيدر Authorization
 * ويُرفق بيانات المستخدم الحالي + أدواره وصلاحياته الفعّالة في req.user.
 * (تحميل الأدوار/الصلاحيات هنا مرة واحدة لكل طلب، بدل تكرار الاستعلام
 * داخل كل middleware تحقق لاحق).
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'مطلوب تسجيل الدخول للوصول لهذا المورد');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(payload.sub);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'المستخدم غير موجود أو غير مفعّل');
    }

    const [roleCodes, permissions] = await Promise.all([
      rbacService.getEffectiveRoleCodes(user.id),
      rbacService.getEffectivePermissions(user.id),
    ]);

    req.user = user;
    req.user.roleCodes = roleCodes;
    req.user.permissions = permissions;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'الجلسة غير صالحة أو منتهية، الرجاء تسجيل الدخول مجدداً'));
    }
    next(err);
  }
};

/**
 * يقيّد الوصول لأدوار محددة فقط، مثال: authorize('admin').
 * طبقة توافق خلفي: يعمل الآن بمطابقة req.user.roleCodes (من user_roles)
 * بدل عمود role الثابت القديم، دون تغيير توقيع الاستدعاء في أي راوت حالي.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !req.user.roleCodes?.some((code) => allowedRoles.includes(code))) {
    return next(new ApiError(403, 'لا تملك صلاحية الوصول لهذا المورد'));
  }
  next();
};

/**
 * تحقق دقيق بحسب الصلاحية (permission-based)، مع تحقق إلزامي أن الصلاحية
 * سارية ضمن مؤسسة السياق الحالي (req.organizationId من resolveAuthenticatedTenant)
 * وليس أي مؤسسة أخرى ينتمي إليها المستخدم. هذا يمنع تسرّب صلاحية (مثال:
 * users.manage) اكتسبها المستخدم في مؤسسة أ لتُستخدم فعلياً على بيانات
 * مؤسسة ب لمجرد أنه عضو في كلتيهما.
 *
 * مثال: authorizePermission('complaints.assign')
 * مثال مع نطاق أدق: authorizePermission('complaints.view_own', (req) => req.params.orgUnitId)
 */
const authorizePermission = (permissionCode, resolveOrgUnitId = null) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'مطلوب تسجيل الدخول للوصول لهذا المورد'));
  }
  if (!req.organizationId) {
    // فشل مبكر: لم يُحدَّد سياق المؤسسة بعد (ترتيب middleware خاطئ) -
    // رفض بدل السماح خطأً بصلاحية غير مُقيَّدة بمؤسسة.
    return next(new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل التحقق من الصلاحية'));
  }

  const orgUnitId = resolveOrgUnitId ? Number(resolveOrgUnitId(req)) || null : null;
  const hasPermission = req.user.permissions?.some((p) => {
    if (p.code !== permissionCode) return false;
    if (p.organizationId !== req.organizationId) return false;
    if (orgUnitId == null) return true;
    return p.orgUnitId == null || p.orgUnitId === orgUnitId;
  });

  if (!hasPermission) {
    return next(new ApiError(403, 'لا تملك صلاحية الوصول لهذا المورد ضمن هذه المؤسسة'));
  }
  next();
};

module.exports = { authenticate, authorize, authorizePermission };
