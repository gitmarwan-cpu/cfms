'use strict';

/**
 * نمط "Template + Override" الشائع في منصات SaaS الجيدة (ويُعتبر أحد نقاط
 * الضعف الشهيرة في أنظمة كبيرة كـ SAP/Oracle حين تُصبح التخصيصات معقّدة
 * لدرجة يصعب معها الترقية لاحقاً): organization_id = NULL يعني قائمة
 * مرجعية نظامية افتراضية متاحة لكل المؤسسات كنقطة بداية جاهزة (Category,
 * Channel...)، بينما organization_id بقيمة يعني أن المؤسسة أنشأت نسخة
 * خاصة بها (إما بالتعديل على النسخة الافتراضية أو بإضافة قائمة جديدة كلياً)
 * دون التأثير على بقية المؤسسات - وهذا يحل فعلياً مشكلة "التخصيص الكاسر
 * للترقيات المستقبلية" التي تعاني منها تلك الأنظمة التقليدية.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('reference_lists', 'organization_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addIndex('reference_lists', ['organization_id']);

    // الفهرس الفريد القديم على `key` وحدها (اسمه المولّد تلقائياً من Postgres،
    // غالباً reference_lists_key_key) كان يفترض قائمة نظامية واحدة فقط عالمياً؛
    // نبحث عنه ديناميكياً بدل افتراض اسم ثابت، ثم نستبدله بفهرس يفرّق بين
    // النظامي (NULL) وكل مؤسسة.
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'reference_lists'::regclass
        AND contype = 'u'
        AND conname != 'reference_lists_pkey';
    `);
    for (const { conname } of constraints) {
      await queryInterface.sequelize.query(`ALTER TABLE reference_lists DROP CONSTRAINT IF EXISTS "${conname}";`);
    }
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS reference_lists_key;');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX reference_lists_key_scope_unique
      ON reference_lists ("key", COALESCE(organization_id, 0));
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS reference_lists_key_scope_unique;');
    await queryInterface.removeColumn('reference_lists', 'organization_id');
  },
};
