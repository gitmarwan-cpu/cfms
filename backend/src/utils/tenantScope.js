'use strict';

const ApiError = require('./ApiError');

/**
 * يدمج organizationId إلزامياً في أي where clause قبل تنفيذ الاستعلام.
 * الهدف: جعل نسيان تصفية المؤسسة صعباً هيكلياً - أي service يستخدم هذه
 * الدالة بدل كتابة `where: { ... }` مباشرة لا يمكنه إغفال organization_id
 * إلا بتجاوز الدالة عمداً (وهو ما تكتشفه المراجعة البرمجية بسهولة أكبر
 * من نسيان شرط في مكان متفرق).
 *
 * مثال الاستخدام:
 *   Complaint.findAll(withTenantScope(req.organizationId, { where: { status: 'open' } }))
 *   // يصبح where: { status: 'open', organizationId }
 */
const withTenantScope = (organizationId, options = {}) => {
  if (!organizationId) {
    // فشل مبكر وصريح بدل تنفيذ استعلام غير مُصفّى قد يُسرّب بيانات مؤسسات أخرى
    throw new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل تنفيذ الاستعلام');
  }

  return {
    ...options,
    where: { ...(options.where || {}), organizationId },
  };
};

/**
 * يتحقق أن سجلاً تم جلبه بالفعل (عبر findByPk مثلاً) يتبع فعلاً المؤسسة
 * الحالية، قبل السماح بأي تعديل/حذف/إرجاع بيانات عنه. يُستخدم بعد
 * findByPk لأنها لا تدعم دمج where تلقائياً.
 */
const assertBelongsToTenant = (record, organizationId, notFoundMessage = 'السجل غير موجود') => {
  const ApiErrorClass = require('./ApiError');
  if (!record || record.organizationId !== organizationId) {
    throw new ApiErrorClass(404, notFoundMessage);
  }
  return record;
};

module.exports = { withTenantScope, assertBelongsToTenant };
