'use strict';

/**
 * البيانات الحالية في governorates كلها محافظات يمنية (راجع ملف
 * "المحافظات اليمنية والمديريات.xlsx" في المشروع)، لذا الـ backfill يفترض
 * اليمن تحديداً لكل الصفوف الحالية بأمان، دون التأثير على قابلية إضافة
 * دول أخرى مستقبلاً (متطلب أساسي لمنصة SaaS متعددة المؤسسات/الدول).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'governorates',
        'country_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'countries', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t }
      );

      const now = new Date();
      await queryInterface.sequelize.query(
        `
        INSERT INTO countries (iso2, iso3, name_ar, name_en, is_active, created_at, updated_at)
        VALUES ('YE', 'YEM', 'اليمن', 'Yemen', true, :now, :now)
        ON CONFLICT (iso2) DO NOTHING;
        `,
        { replacements: { now }, transaction: t }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE governorates g
        SET country_id = c.id
        FROM countries c
        WHERE c.iso2 = 'YE' AND g.country_id IS NULL;
        `,
        { transaction: t }
      );

      await queryInterface.changeColumn(
        'governorates',
        'country_id',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'countries', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        { transaction: t }
      );

      await queryInterface.addIndex('governorates', ['country_id'], { transaction: t });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('governorates', 'country_id');
  },
};
