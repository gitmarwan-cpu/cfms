'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('complaint_status_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      complaint_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'complaints', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      from_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      to_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      changed_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('complaint_status_history', ['complaint_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('complaint_status_history');
  },
};
