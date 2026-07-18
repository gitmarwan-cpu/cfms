'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

const generateToken = (user) => {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
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

  const token = generateToken(user);
  const { passwordHash, ...userSafe } = user.toJSON();

  return { token, user: userSafe };
};

/**
 * تسجيل مستخدم جديد (staff) - يُقيَّد لاحقاً بحيث لا يستدعيه
 * سوى مستخدم admin مصادق عليه (يُطبَّق ذلك في الراوت عبر
 * middlewares/auth.js -> authorize('admin')).
 */
const register = async ({ fullName, email, password, role }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'البريد الإلكتروني مستخدم بالفعل');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role: role || 'staff',
  });

  return user;
};

module.exports = { login, register, generateToken };
