'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('countries', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      iso2: {
        type: Sequelize.STRING(2),
        allowNull: false,
        unique: true,
      },
      iso3: {
        type: Sequelize.STRING(3),
        allowNull: true,
        unique: true,
      },
      name_ar: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      name_en: {
        type: Sequelize.STRING(150),
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
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('countries');
  },
};
