'use strict';

/**
 * قبل هذا الـ migration، كان user_roles.org_unit_id (NULL = عام على مستوى
 * المؤسسة) يعتمد ضمنياً على وجود مؤسسة واحدة فقط في النظام لتحديد "أي مؤسسة".
 * الآن بعد أن أصبحت علاقة User↔Organization صريحة Many-to-Many، يجب أن يحمل
 * كل تعيين دور organization_id صراحة ولا يجوز تركه ضمنياً.
 *
 * Backfill: كل صف user_roles حالي يُربط بأول مؤسسة نشطة (نفس افتراض
 * migration user_organizations، لأن النظام لا يزال أحادي المؤسسة فعلياً
 * حتى تاريخه رغم أن البنية أصبحت تدعم التعدد).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'user_roles',
        'organization_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true, // مؤقتاً أثناء الـ backfill، يُصبح NOT NULL في الخطوة الأخيرة
          references: { model: 'organizations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        { transaction: t }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE user_roles ur
        SET organization_id = org.id
        FROM (SELECT id FROM organizations ORDER BY id ASC LIMIT 1) org
        WHERE ur.organization_id IS NULL;
        `,
        { transaction: t }
      );

      await queryInterface.changeColumn(
        'user_roles',
        'organization_id',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'organizations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        { transaction: t }
      );

      // استبدال الفهرس الفريد القديم (لم يكن يميّز بين مؤسسات) بآخر يشمل organization_id
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS user_roles_scope_unique;', { transaction: t });
      await queryInterface.sequelize.query(
        `
        CREATE UNIQUE INDEX user_roles_scope_unique
        ON user_roles (user_id, role_id, organization_id, COALESCE(org_unit_id, 0));
        `,
        { transaction: t }
      );

      await queryInterface.addIndex('user_roles', ['organization_id'], { transaction: t });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS user_roles_scope_unique;', { transaction: t });
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX user_roles_scope_unique ON user_roles (user_id, role_id, COALESCE(org_unit_id, 0));`,
        { transaction: t }
      );
      await queryInterface.removeColumn('user_roles', 'organization_id', { transaction: t });
    });
  },
};
