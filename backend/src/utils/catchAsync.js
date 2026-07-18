'use strict';

/**
 * يغلّف أي دالة كنترولر async ليمرر الأخطاء تلقائياً إلى errorHandler
 * بدلاً من تكرار try/catch في كل كنترولر.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
