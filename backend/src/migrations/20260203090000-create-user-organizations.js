'use strict';

/**
 * علاقة صريحة Many-to-Many بين User وOrganization (بدل الاعتماد الضمني على
 * user_roles فقط)، بحيث يملك النظام مفهوم "عضوية" مستقل عن "الصلاحية":
 * قد ينضم مستخدم لمؤسسة (عضوية) دون أن يُسند له دور بعد.
 *
 * is_primary: يحدد المؤسسة الافتراضية عند دخول المستخدم (لواجهة تبديل
 * المؤسسة Org Switcher لاحقاً)؛ صف واحد فقط لكل مستخدم يجب أن يكون primary
 * (يُنفَّذ هذا الشرط على مستوى التطبيق في userOrganizationService، وليس
 * قيداً في قاعدة البيانات، تفادياً لتعقيد غير ضروري في هذه المرحلة).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_organizations', {
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
      organization_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      is_primary: {
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

    await queryInterface.addIndex('user_organizations', ['user_id', 'organization_id'], {
      unique: true,
      name: 'user_organizations_unique',
    });

    // Backfill: كل مستخدم حالي يُعتبر عضواً في أول مؤسسة نشطة (الوضع الحالي:
    // مؤسسة واحدة فقط)، ويُعتبر عضويته أساسية (is_primary = true).
    const now = new Date();
    await queryInterface.sequelize.query(
      `
      INSERT INTO user_organizations (user_id, organization_id, is_primary, is_active, created_at, updated_at)
      SELECT u.id, org.id, true, true, :now, :now
      FROM users u, (SELECT id FROM organizations ORDER BY id ASC LIMIT 1) org
      ON CONFLICT DO NOTHING;
      `,
      { replacements: { now } }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_organizations');
  },
};
