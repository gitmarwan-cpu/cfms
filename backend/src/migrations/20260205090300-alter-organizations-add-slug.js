'use strict';

/**
 * المستفيد الذي يقدّم شكوى غير مسجّل دخوله إطلاقاً (بند "سادساً" في التوجيه
 * المعماري: "المستفيدون لا يحتاجون إلى إنشاء حساب") - لذا لا يمكن تحديد
 * المؤسسة المستهدفة من التوكن كما في المسارات الإدارية. الحل القياسي في
 * SaaS: مُعرِّف علني قصير (slug) يُستخدم في رابط نموذج الشكوى الخاص بكل
 * مؤسسة، مثال: cfms.example.com/o/save-the-children-ye
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('organizations', 'slug', {
      type: Sequelize.STRING(80),
      allowNull: true,
    });

    // Backfill: توليد slug من short_name لأي مؤسسة موجودة حالياً (واحدة فقط اليوم)
    await queryInterface.sequelize.query(`
      UPDATE organizations
      SET slug = 'org-' || id
      WHERE slug IS NULL;
    `);

    await queryInterface.changeColumn('organizations', 'slug', {
      type: Sequelize.STRING(80),
      allowNull: false,
    });

    await queryInterface.addIndex('organizations', ['slug'], { unique: true });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('organizations', 'slug');
  },
};
