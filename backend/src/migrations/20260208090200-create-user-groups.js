'use strict';

/**
 * عضوية مستخدم في مجموعة، ضمن مؤسسة محددة صراحة (نفس منطق user_roles):
 * لا عضوية "عامة" بلا مؤسسة، لأن نفس المستخدم قد ينتمي لعدة مؤسسات
 * (user_organizations) بأدوار/مجموعات مختلفة تماماً في كل منها.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_groups', {
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
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'groups', key: 'id' },
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
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('user_groups', ['user_id', 'group_id', 'organization_id'], {
      unique: true,
      name: 'user_groups_unique',
    });
    await queryInterface.addIndex('user_groups', ['user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_groups');
  },
};
