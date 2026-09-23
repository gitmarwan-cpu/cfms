import rateLimit from 'express-rate-limit';

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات تسجيل دخول كثيرة جداً، الرجاء المحاولة لاحقاً' },
});

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'طلبات كثيرة جداً، الرجاء المحاولة لاحقاً' },
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات كثيرة جداً، الرجاء المحاولة لاحقاً' },
});

const trackComplaintRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات متابعة كثيرة جداً، الرجاء المحاولة لاحقاً بعد ساعة' },
});

const submitComplaintRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'عدد كبير جداً من الطلبات، الرجاء المحاولة لاحقاً' },
});

export {
  loginRateLimiter,
  forgotPasswordRateLimiter,
  passwordResetRateLimiter,
  trackComplaintRateLimiter,
  submitComplaintRateLimiter,
};
