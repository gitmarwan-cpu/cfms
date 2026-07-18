'use strict';

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json({ success: true, data: result });
});

const register = catchAsync(async (req, res) => {
  const user = await authService.register(req.body);
  const { passwordHash, ...userSafe } = user.toJSON();
  res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', data: userSafe });
});

const me = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

module.exports = { login, register, me };
