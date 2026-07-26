'use strict';

/**
 * يستبدل هذا الجدول عمود users.role الثابت (ENUM('admin','staff'))
 * بجدول أدوار قابل للإدارة من لوحة الإدارة دون تعديل الكود، بما يتوافق
 * مع بند "سادساً" في التوجيه المعماري (RBAC مرن وقابل للتخصيص بالكامل).
 *
 * is_system = true يعني دوراً أساسياً لا يجوز حذفه (admin/staff) لضمان
 * عدم فقدان النظام لصلاحيات إدارية بالكامل عن طريق الخطأ.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('roles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      code: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },
      name_ar: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      name_en: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_system: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    await queryInterface.dropTable('roles');
  },
};
