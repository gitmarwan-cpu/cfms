'use strict';

/**
 * فجوة عزل حرجة: جدول complaints لم يكن يحمل organization_id إطلاقاً رغم
 * أنه الجدول الأكثر حساسية في النظام (بيانات شكاوى قد تتضمن معلومات شخصية
 * حساسة عن مبلّغين). في معمارية SaaS متعددة المؤسسات على قاعدة مشتركة،
 * أي جدول يخص مؤسسة معينة يجب أن يحمل organization_id، وإلا فلا معنى
 * لعزل المؤسسات عملياً - أي استعلام ناقص لشرط organization_id سيُسرّب
 * بيانات مؤسسة أخرى.
 *
 * Backfill: كل الشكاوى الحالية تُنسب لأول مؤسسة (الوضع الفعلي اليوم:
 * مؤسسة واحدة فقط)، ثم يُصبح العمود إلزامياً NOT NULL.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'complaints',
        'organization_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'organizations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE complaints c
        SET organization_id = org.id
        FROM (SELECT id FROM organizations ORDER BY id ASC LIMIT 1) org
        WHERE c.organization_id IS NULL;
        `,
        { transaction: t }
      );

      await queryInterface.changeColumn(
        'complaints',
        'organization_id',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'organizations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t }
      );

      await queryInterface.addIndex('complaints', ['organization_id'], { transaction: t });
      // فهرس مركّب: أغلب الاستعلامات ستُصفّي دائماً بالمؤسسة أولاً ثم بالحالة/التاريخ
      await queryInterface.addIndex('complaints', ['organization_id', 'created_at'], { transaction: t });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('complaints', 'organization_id');
  },
};
