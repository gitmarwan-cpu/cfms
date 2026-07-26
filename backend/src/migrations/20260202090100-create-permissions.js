'use strict';

/**
 * كتالوج صلاحيات دقيق (permission-based)، بديلاً عن التحقق بالاعتماد على اسم
 * الدور فقط. كل صلاحية مرتبطة بوحدة (module) لتسهيل عرضها مجمّعة في لوحة الإدارة.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('permissions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      code: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      module: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      description_ar: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex('permissions', ['module']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('permissions');
  },
};
