'use strict';

/**
 * يزرع القوائم المرجعية الأساسية بنفس القيم (codes) المستخدمة سابقاً كثوابت
 * في الكود، لضمان توافق تام مع بيانات الشكاوى الحالية وسلوك الواجهة الحالي.
 * أي قيمة إضافية مستقبلاً تُضاف من لوحة الإدارة دون الحاجة لتعديل الكود.
 */

const LISTS = [
  {
    key: 'gender',
    name_ar: 'الجنس',
    name_en: 'Gender',
    is_system: true,
    items: [
      { code: 'male', label_ar: 'ذكر', label_en: 'Male', sort_order: 1 },
      { code: 'female', label_ar: 'أنثى', label_en: 'Female', sort_order: 2 },
    ],
  },
  {
    key: 'age_group',
    name_ar: 'الفئة العمرية',
    name_en: 'Age Group',
    is_system: true,
    items: [
      { code: 'under_18', label_ar: 'أقل من 18', label_en: 'Under 18', sort_order: 1 },
      { code: '18_30', label_ar: '18 - 30', label_en: '18 - 30', sort_order: 2 },
      { code: '31_45', label_ar: '31 - 45', label_en: '31 - 45', sort_order: 3 },
      { code: '46_60', label_ar: '46 - 60', label_en: '46 - 60', sort_order: 4 },
      { code: 'above_60', label_ar: 'أكثر من 60', label_en: 'Above 60', sort_order: 5 },
    ],
  },
  {
    key: 'complaint_category',
    name_ar: 'تصنيف الشكوى',
    name_en: 'Complaint Category',
    is_system: false,
    items: [
      { code: 'service_quality', label_ar: 'جودة الخدمة', label_en: 'Service Quality', sort_order: 1 },
      { code: 'staff_behavior', label_ar: 'سلوك موظف', label_en: 'Staff Behavior', sort_order: 2 },
      { code: 'corruption_fraud', label_ar: 'فساد / احتيال', label_en: 'Corruption / Fraud', sort_order: 3 },
      { code: 'distribution_issue', label_ar: 'مشكلة في التوزيع', label_en: 'Distribution Issue', sort_order: 4 },
      {
        code: 'protection_gbv',
        label_ar: 'حماية / عنف قائم على النوع الاجتماعي (حساسة)',
        label_en: 'Protection / GBV (Sensitive)',
        sort_order: 5,
        meta: { forcesSensitive: true },
      },
      { code: 'suggestion', label_ar: 'مقترح تحسين', label_en: 'Improvement Suggestion', sort_order: 6 },
      { code: 'other', label_ar: 'أخرى', label_en: 'Other', sort_order: 7 },
    ],
  },
  {
    key: 'channel',
    name_ar: 'قناة الاستلام',
    name_en: 'Reception Channel',
    is_system: false,
    items: [
      { code: 'website', label_ar: 'الموقع الإلكتروني', label_en: 'Website', sort_order: 1, is_default: true },
      { code: 'in_person', label_ar: 'حضوري', label_en: 'In Person', sort_order: 2 },
      { code: 'hotline', label_ar: 'الخط الساخن', label_en: 'Hotline', sort_order: 3 },
      { code: 'suggestion_box', label_ar: 'صندوق الاقتراحات', label_en: 'Suggestion Box', sort_order: 4 },
      { code: 'email', label_ar: 'البريد الإلكتروني', label_en: 'Email', sort_order: 5 },
      { code: 'field_visit', label_ar: 'زيارة ميدانية', label_en: 'Field Visit', sort_order: 6 },
    ],
  },
  {
    key: 'complaint_type',
    name_ar: 'نوع الطلب',
    name_en: 'Request Type',
    is_system: true,
    items: [
      { code: 'complaint', label_ar: 'شكوى', label_en: 'Complaint', sort_order: 1 },
      { code: 'proposal', label_ar: 'مقترح', label_en: 'Proposal', sort_order: 2 },
    ],
  },
  {
    key: 'priority',
    name_ar: 'الأولوية',
    name_en: 'Priority',
    is_system: false,
    items: [
      { code: 'low', label_ar: 'منخفضة', label_en: 'Low', sort_order: 1, meta: { color: '#5b6b6c' } },
      { code: 'normal', label_ar: 'عادية', label_en: 'Normal', sort_order: 2, is_default: true, meta: { color: '#0e5f66' } },
      { code: 'high', label_ar: 'عالية', label_en: 'High', sort_order: 3, meta: { color: '#c77b3f' } },
      { code: 'urgent', label_ar: 'عاجلة', label_en: 'Urgent', sort_order: 4, meta: { color: '#b3261e' } },
    ],
  },
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    for (const list of LISTS) {
      const [listRow] = await queryInterface.sequelize.query(
        `INSERT INTO reference_lists (key, name_ar, name_en, is_system, created_at, updated_at)
         VALUES (:key, :nameAr, :nameEn, :isSystem, :now, :now)
         RETURNING id`,
        {
          replacements: {
            key: list.key,
            nameAr: list.name_ar,
            nameEn: list.name_en,
            isSystem: list.is_system,
            now,
          },
          type: queryInterface.sequelize.QueryTypes.INSERT,
        }
      );

      const listId = listRow[0].id;

      const itemsToInsert = list.items.map((item) => ({
        reference_list_id: listId,
        code: item.code,
        label_ar: item.label_ar,
        label_en: item.label_en || null,
        sort_order: item.sort_order || 0,
        is_active: true,
        is_default: !!item.is_default,
        meta: item.meta ? JSON.stringify(item.meta) : null,
        created_at: now,
        updated_at: now,
      }));

      await queryInterface.bulkInsert('reference_list_items', itemsToInsert);
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('reference_list_items', null, {});
    await queryInterface.bulkDelete('reference_lists', null, {});
  },
};
