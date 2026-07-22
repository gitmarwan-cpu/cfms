'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('org_unit_types', {
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
      code: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      name_ar: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      name_en: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      // مستوى الهيكل: رقم أصغر = أقرب لجذر المؤسسة (1 مباشرة تحت المؤسسة)
      hierarchy_level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      // نوع الأصل المسموح به لهذا النوع (self-reference)؛ NULL يعني يُلحق مباشرة بالمؤسسة
      allowed_parent_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'org_unit_types', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('org_unit_types', ['organization_id', 'code'], {
      unique: true,
      name: 'org_unit_types_org_code_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('org_unit_types');
  },
};
