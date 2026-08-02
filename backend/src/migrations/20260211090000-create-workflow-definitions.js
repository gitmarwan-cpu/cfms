'use strict';

/**
 * تعريف سير عمل (Workflow Definition): قدرة عامة في Core Platform، وليست
 * خاصة بوحدة الشكاوى (راجع entity_type). نمط Template+Override مطابق
 * تماماً لـ roles/groups/reference_lists:
 * organization_id = NULL يعني تعريفاً نظامياً متاحاً لكل المؤسسات كنقطة
 * بداية؛ قيمة تعني تعريفاً مخصَّصاً أنشأته مؤسسة معينة فقط.
 *
 * هذه الدفعة (Phase 1.5 Part 1) تبني طبقة قاعدة البيانات فقط - بلا أي
 * منطق تنفيذ (Execution)، بلا routes، بلا services. راجع
 * docs/ROADMAP.md لحالة الأجزاء اللاحقة.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('workflow_definitions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      code: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name_ar: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      name_en: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      // نوع الكيان الذي يستخدم هذا التعريف (مثال: 'complaint'). عام بقصد -
      // يسمح لأي وحدة أعمال مستقبلية باستخدام نفس البنية دون تعديلها.
      entity_type: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('workflow_definitions', ['organization_id']);
    await queryInterface.addIndex('workflow_definitions', ['entity_type']);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX workflow_definitions_code_scope_unique
      ON workflow_definitions (code, COALESCE(organization_id, 0));
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('workflow_definitions');
  },
};
