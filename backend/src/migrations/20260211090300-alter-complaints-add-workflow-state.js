'use strict';

/**
 * إضافة بحتة (Additive) لا تمس السلوك الحالي إطلاقاً: عمود اختياري جديد
 * فقط. عمود complaints.status (ENUM) يبقى كما هو دون حذف أو إعادة تسمية،
 * ولا يُملأ workflow_state_id لأي شكوى موجودة مسبقاً (بلا Backfill) -
 * بقرار صريح لهذه الدفعة (Phase 1.5 Part 1: قاعدة بيانات فقط، بلا منطق
 * ترحيل). ربط الشكاوى الفعلي بحالات Workflow يُبنى في جزء لاحق.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('complaints', 'workflow_state_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'workflow_states', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('complaints', ['workflow_state_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('complaints', 'workflow_state_id');
  },
};
