'use strict';

/**
 * مجموعة (Group): آلية توزيع أدوار على عدة مستخدمين دفعة واحدة، بالتوازي
 * التام مع الإسناد المباشر user_roles (لا تُلغيه ولا تُعدِّل عليه).
 *
 * نمط Template+Override مطابق لـ roles/reference_lists: organization_id
 * = NULL يعني مجموعة نظامية جاهزة (مثال: "موظفو معالجة الشكاوى") متاحة
 * كنقطة بداية لكل المؤسسات؛ قيمة = مجموعة خاصة أنشأتها مؤسسة معينة فقط.
 *
 * لا يوجد توريث هرمي في هذه النسخة (parent_group_id) بقرار صريح لتبسيط
 * أول تطبيق. البنية مُعدّة للتوسع لاحقاً عبر جدول منفصل
 * group_implied_groups (م:م، وليس عمود self-reference) دون أي migration
 * تعديلية على هذا الجدول.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('groups', {
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

    await queryInterface.addIndex('groups', ['organization_id']);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX groups_code_scope_unique
      ON groups (code, COALESCE(organization_id, 0));
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('groups');
  },
};
