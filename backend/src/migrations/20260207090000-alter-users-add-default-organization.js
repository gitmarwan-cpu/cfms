'use strict';

/**
 * كل مستخدم جديد (عدا المدير الأول المُنشأ في Bootstrap) يجب أن يُسنَد
 * لمؤسسة موجودة مسبقاً صراحة عند إنشائه - يُخزَّن ذلك في هذا العمود
 * كمؤسسة افتراضية (تُستخدم عند تحديد سياق المؤسسة إن لم يُرسل العميل
 * X-Organization-Id، بدل الاعتماد فقط على user_organizations.is_primary).
 *
 * لا يُلغي هذا علاقة User↔Organization متعددة إلى متعددة (تبقى عبر
 * user_organizations) - هذا مجرد "مؤشر افتراضي سريع" فوقها.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'default_organization_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill: أي مستخدم حالي له عضوية أساسية (is_primary) يُنسخ مؤشره هنا
    await queryInterface.sequelize.query(`
      UPDATE users u
      SET default_organization_id = uo.organization_id
      FROM user_organizations uo
      WHERE uo.user_id = u.id AND uo.is_primary = true AND u.default_organization_id IS NULL;
    `);

    await queryInterface.addIndex('users', ['default_organization_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'default_organization_id');
  },
};
