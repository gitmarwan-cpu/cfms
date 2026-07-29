'use strict';

const rateLimit = require('express-rate-limit');

/**
 * كان مطلوباً صراحة في متطلبات الأمن الأصلية ("Rate Limiting") ولم يكن
 * منفَّذاً إطلاقاً - أخطر أثر عملي لغيابه: تسجيل الدخول قابل لتجربة كل
 * كلمات المرور آلياً، ورمز متابعة الشكوى (PIN من 6 أرقام فقط = مليون
 * احتمال) قابل للـ Brute Force الكامل خلال وقت معقول.
 *
 * standardHeaders/legacyHeaders: تُرجع حدود الاستخدام في هيدرز الاستجابة
 * القياسية (RateLimit-*) بدل الأسلوب القديم غير المعياري.
 */

// تسجيل الدخول: صارم نسبياً، لكن لا يمنع مستخدماً شرعياً ينسى كلمة المرور
// مرة أو مرتين خلال ربع ساعة.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات تسجيل دخول كثيرة جداً، الرجاء المحاولة لاحقاً' },
});

// متابعة الشكوى عبر PIN: أكثر صرامة لأن مساحة الاحتمالات صغيرة (6 أرقام)
// ويجب أن يكون تخمينها بالكامل غير عملي حتى لمهاجم صبور.
const trackComplaintRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'محاولات متابعة كثيرة جداً، الرجاء المحاولة لاحقاً بعد ساعة' },
});

// تقديم الشكوى العامة: حماية أساسية من السبام/DoS بدون إزعاج مستخدم شرعي
const submitComplaintRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'عدد كبير جداً من الطلبات، الرجاء المحاولة لاحقاً' },
});

module.exports = { loginRateLimiter, trackComplaintRateLimiter, submitComplaintRateLimiter };
