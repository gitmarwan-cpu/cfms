'use strict';

/**
 * seeder منفصل عمداً وليس إضافة لقائمة LISTS في seed-reference-data.js:
 * ذلك الملف له حارس idempotency شامل ("إن وُجدت أي قائمة نظامية، تخطَّ
 * الملف بالكامل") - إضافة عنصر جديد له لن يُطبَّق أبداً على أي قاعدة
 * بيانات سبق زرعها. الحل الصحيح لأي قائمة مرجعية جديدة تُضاف لاحقاً هو
 * seeder مستقل بحارس idempotency خاص بمفتاحه هو فقط.
 */
const RELATIONSHIP_ITEMS = [
  { code: 'beneficiary', label_ar: 'مستفيد', label_en: 'Beneficiary', sort_order: 1, is_default: true },
  { code: 'community_member', label_ar: 'فرد من المجتمع', label_en: 'Community Member', sort_order: 2 },
  { code: 'visitor', label_ar: 'زائر', label_en: 'Visitor', sort_order: 3 },
  { code: 'employee', label_ar: 'موظف', label_en: 'Employee', sort_order: 4 },
  { code: 'contractor', label_ar: 'مقاول', label_en: 'Contractor', sort_order: 5 },
  { code: 'service_provider', label_ar: 'مقدّم خدمة', label_en: 'Service Provider', sort_order: 6 },
  { code: 'partner', label_ar: 'شريك', label_en: 'Partner', sort_order: 7 },
  { code: 'other', label_ar: 'أخرى', label_en: 'Other', sort_order: 8 },
];

module.exports = {
  up: async (queryInterface) => {
    const [[{ count }]] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int FROM reference_lists WHERE key = 'complainant_relationship' AND organization_id IS NULL;`
    );
    if (count > 0) return;

    const now = new Date();

    const [listRow] = await queryInterface.sequelize.query(
      `INSERT INTO reference_lists (key, name_ar, name_en, is_system, created_at, updated_at)
       VALUES ('complainant_relationship', 'علاقة مقدّم الطلب بالمؤسسة', 'Complainant Relationship', false, :now, :now)
       RETURNING id;`,
      { replacements: { now }, type: queryInterface.sequelize.QueryTypes.INSERT }
    );
    const listId = listRow[0].id;

    await queryInterface.bulkInsert(
      'reference_list_items',
      RELATIONSHIP_ITEMS.map((item) => ({
        reference_list_id: listId,
        code: item.code,
        label_ar: item.label_ar,
        label_en: item.label_en,
        sort_order: item.sort_order,
        is_active: true,
        is_default: !!item.is_default,
        meta: null,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE FROM reference_lists WHERE key = 'complainant_relationship' AND organization_id IS NULL;`
    );
  },
};
