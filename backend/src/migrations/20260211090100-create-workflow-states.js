'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('workflow_states', {
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
      is_initial: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_final: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('workflow_states', ['workflow_definition_id']);
    await queryInterface.addIndex('workflow_states', ['workflow_definition_id', 'code'], {
      unique: true,
      name: 'workflow_states_definition_code_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('workflow_states');
  },
};
