'use strict';

/**
 * يربط المستخدم بدور معيّن، مع نطاق اختياري (org_unit_id).
 * - org_unit_id = NULL → الدور ساري على مستوى المؤسسة كاملة (مثال: admin عام).
 * - org_unit_id = قيمة → الدور مقصور على تلك الوحدة التنظيمية فقط (مثال:
 *   "مسؤول قسم" له صلاحية على قسمه فقط)، بما يحقق Scoped RBAC المتفق عليه.
 *
 * فهرس فريد جزئي (partial-like عبر COALESCE) لمنع تكرار نفس التعيين، مع
 * معاملة NULL كقيمة موحّدة (0) بدل تجاهلها كما تفعل Postgres افتراضياً
 * مع الفهارس الفريدة العادية.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_roles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      org_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'org_units', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX user_roles_scope_unique
      ON user_roles (user_id, role_id, COALESCE(org_unit_id, 0));
    `);

    await queryInterface.addIndex('user_roles', ['user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_roles');
  },
};
