'use strict';

/**
 * فصل معماري جوهري: مقدّم الشكوى (Complainant) ليس مستخدم نظام (User).
 * لا حساب، لا كلمة مرور، لا تسجيل دخول - مجرد سجل هوية اختياري (قد يكون
 * فارغاً تماماً في حال الشكوى المجهولة الكاملة) يُستخدم فقط لعرض بيانات
 * التواصل/الديموغرافيا المرتبطة بشكوى أو أكثر لنفس الشخص.
 *
 * organization_id: يبقى الـ Complainant ضمن نطاق مؤسسة واحدة (لا يُشارك
 * بين المؤسسات) تماشياً مع نموذج العزل الحالي، دون منع تطويره لاحقاً إلى
 * "هوية مستفيد" مشتركة عبر مؤسسات عند الحاجة الفعلية (نظام تسجيل مستفيدين
 * مركزي)، وهو ما أشار إليه المستخدم كـ "beneficiary_id" اختياري خارجي.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('complainants', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      full_name: { type: Sequelize.STRING(150), allowNull: true },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      email: { type: Sequelize.STRING(150), allowNull: true },
      gender_item_id: { type: Sequelize.INTEGER, allowNull: true },
      age_group_item_id: { type: Sequelize.INTEGER, allowNull: true },
      // مُعرِّف خارجي اختياري لربط سجل الشكوى بنظام تسجيل مستفيدين منفصل
      // (Beneficiary Registration System)، دون أن يفرض النظام وجوده.
      beneficiary_external_id: { type: Sequelize.STRING(100), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('complainants', ['organization_id']);
    await queryInterface.addIndex('complainants', ['organization_id', 'phone']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('complainants');
  },
};
