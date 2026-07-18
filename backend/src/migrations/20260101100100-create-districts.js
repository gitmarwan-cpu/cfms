'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('districts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name_en: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      name_ar: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      governorate_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'governorates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
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

    await queryInterface.addIndex('districts', ['governorate_id', 'name_en'], {
      unique: true,
      name: 'districts_gov_name_en_unique',
    });
    await queryInterface.addIndex('districts', ['governorate_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('districts');
  },
};
