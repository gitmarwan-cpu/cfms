'use strict';

/**
 * نفس نمط Template+Override المطبَّق على reference_lists: الأدوار النظامية
 * (admin/staff, is_system=true) تبقى organization_id = NULL ومتاحة لكل
 * المؤسسات كنقطة بداية، بينما يمكن لأي مؤسسة إنشاء أدوار خاصة بها فقط
 * (مثال: "منسق إقليمي") دون أن تظهر لبقية المؤسسات أو تتأثر بتعديلاتها.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('roles', 'organization_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addIndex('roles', ['organization_id']);

    const [constraints] = await queryInterface.sequelize.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'roles'::regclass
        AND contype = 'u'
        AND conname != 'roles_pkey';
    `);
    for (const { conname } of constraints) {
      await queryInterface.sequelize.query(`ALTER TABLE roles DROP CONSTRAINT IF EXISTS "${conname}";`);
    }
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX roles_code_scope_unique
      ON roles (code, COALESCE(organization_id, 0));
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS roles_code_scope_unique;');
    await queryInterface.removeColumn('roles', 'organization_id');
  },
};
