'use strict';

/**
 * from_state_id = NULL يعني أن الانتقال مسموح من أي حالة حالية (لم يُستخدَم
 * في seed هذه الدفعة، لكن البنية تدعمه لتعريفات مستقبلية).
 * requires_permission: كود صلاحية اختياري (نص حر يُطابَق لاحقاً عند بناء
 * طبقة التنفيذ في جزء لاحق من هذه المرحلة - لا تحقق فعلي في هذه الدفعة
 * لأن هذا الجزء يقتصر على قاعدة البيانات فقط، بلا منطق تنفيذ).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('workflow_transitions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      workflow_definition_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'workflow_definitions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      from_state_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'workflow_states', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      to_state_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'workflow_states', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      code: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      name_ar: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      name_en: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      requires_permission: {
        type: Sequelize.STRING(100),
        allowNull: true,
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

    await queryInterface.addIndex('workflow_transitions', ['workflow_definition_id']);
    await queryInterface.addIndex('workflow_transitions', ['workflow_definition_id', 'code'], {
      unique: true,
      name: 'workflow_transitions_definition_code_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('workflow_transitions');
  },
};
