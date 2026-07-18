'use strict';

/**
 * يولّد رقماً مرجعياً بصيغة CFMS-YYYY-XXXXXX يمكن لمقدّم الطلب
 * استخدامه لاحقاً للاستفسار عن حالة شكواه/مقترحه.
 */
function generateReferenceCode() {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `CFMS-${year}-${randomPart}`;
}

module.exports = generateReferenceCode;
