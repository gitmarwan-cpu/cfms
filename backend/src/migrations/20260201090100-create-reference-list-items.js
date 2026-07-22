'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('reference_list_items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      reference_list_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'reference_lists', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      code: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      label_ar: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      label_en: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      meta: {
        type: Sequelize.JSONB,
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

    await queryInterface.addIndex('reference_list_items', ['reference_list_id', 'code'], {
      unique: true,
      name: 'reference_list_items_list_code_unique',
    });
    await queryInterface.addIndex('reference_list_items', ['reference_list_id', 'is_active']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('reference_list_items');
  },
};
