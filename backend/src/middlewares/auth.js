'use strict';

const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { User } = require('../models');

/**
 * يتحقق من وجود توكن JWT صالح في هيدر Authorization
 * ويُرفق بيانات المستخدم الحالي في req.user.
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

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'الجلسة غير صالحة أو منتهية، الرجاء تسجيل الدخول مجدداً'));
    }
    next(err);
  }
};

/**
 * يقيّد الوصول لأدوار محددة فقط، مثال: authorize('admin')
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'لا تملك صلاحية الوصول لهذا المورد'));
  }
  next();
};

module.exports = { authenticate, authorize };
