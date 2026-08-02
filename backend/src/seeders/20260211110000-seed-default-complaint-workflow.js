'use strict';

/**
 * سير عمل نظامي افتراضي (organization_id = NULL) لكيان الشكوى، يطابق
 * قيم status ENUM الحالية تماماً حتى تبقى الشكاوى الحالية متوافقة (لا
 * ترحيل بيانات في هذه الدفعة - راجع migration 20260211090300).
 *
 * idempotent بنمط "check-before-insert" الموثَّق في docs/REFERENCE_DATA.md
 * (فحص وجود مسبق بمفتاح هذا الـ seeder تحديداً)، وليس نمط الحارس الشامل
 * المستخدَم في seed-reference-data.js.
 */
module.exports = {
  up: async (queryInterface) => {
    const [[{ count }]] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int FROM workflow_definitions WHERE code = 'complaint_default' AND organization_id IS NULL;`
    );
    if (count > 0) return;

    const now = new Date();

    const [definitionRows] = await queryInterface.sequelize.query(
      `
      INSERT INTO workflow_definitions (code, name_ar, name_en, entity_type, is_active, organization_id, created_at, updated_at)
      VALUES ('complaint_default', 'سير عمل الشكاوى الافتراضي', 'Default Complaint Workflow', 'complaint', true, NULL, :now, :now)
      RETURNING id;
      `,
      { replacements: { now } }
    );
    const definitionId = definitionRows[0].id;

    const STATES = [
      { code: 'new', name_ar: 'جديدة', name_en: 'New', is_initial: true, is_final: false, sort_order: 1 },
      { code: 'in_review', name_ar: 'قيد المراجعة', name_en: 'In Review', is_initial: false, is_final: false, sort_order: 2 },
      { code: 'resolved', name_ar: 'تم الحل', name_en: 'Resolved', is_initial: false, is_final: false, sort_order: 3 },
      { code: 'closed', name_ar: 'أُغلقت', name_en: 'Closed', is_initial: false, is_final: true, sort_order: 4 },
      { code: 'rejected', name_ar: 'مرفوضة', name_en: 'Rejected', is_initial: false, is_final: true, sort_order: 5 },
    ];

    const stateIdByCode = {};
    for (const state of STATES) {
      // eslint-disable-next-line no-await-in-loop
      const [rows] = await queryInterface.sequelize.query(
        `
        INSERT INTO workflow_states (workflow_definition_id, code, name_ar, name_en, is_initial, is_final, sort_order, created_at, updated_at)
        VALUES (:definitionId, :code, :nameAr, :nameEn, :isInitial, :isFinal, :sortOrder, :now, :now)
        RETURNING id;
        `,
        {
          replacements: {
            definitionId,
            code: state.code,
            nameAr: state.name_ar,
            nameEn: state.name_en,
            isInitial: state.is_initial,
            isFinal: state.is_final,
            sortOrder: state.sort_order,
            now,
          },
        }
      );
      stateIdByCode[state.code] = rows[0].id;
    }

    const TRANSITIONS = [
      { code: 'start_review', name_ar: 'بدء المراجعة', name_en: 'Start Review', from: 'new', to: 'in_review' },
      { code: 'resolve', name_ar: 'حل الشكوى', name_en: 'Resolve', from: 'in_review', to: 'resolved' },
      { code: 'close', name_ar: 'إغلاق الشكوى', name_en: 'Close', from: 'resolved', to: 'closed' },
      { code: 'reject_new', name_ar: 'رفض (من جديدة)', name_en: 'Reject (from New)', from: 'new', to: 'rejected' },
      {
        code: 'reject_in_review',
        name_ar: 'رفض (قيد المراجعة)',
        name_en: 'Reject (from In Review)',
        from: 'in_review',
        to: 'rejected',
      },
    ];

    for (const transition of TRANSITIONS) {
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        `
        INSERT INTO workflow_transitions (workflow_definition_id, from_state_id, to_state_id, code, name_ar, name_en, requires_permission, created_at, updated_at)
        VALUES (:definitionId, :fromStateId, :toStateId, :code, :nameAr, :nameEn, NULL, :now, :now);
        `,
        {
          replacements: {
            definitionId,
            fromStateId: stateIdByCode[transition.from],
            toStateId: stateIdByCode[transition.to],
            code: transition.code,
            nameAr: transition.name_ar,
            nameEn: transition.name_en,
            now,
          },
        }
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE FROM workflow_definitions WHERE code = 'complaint_default' AND organization_id IS NULL;`
    );
  },
};
