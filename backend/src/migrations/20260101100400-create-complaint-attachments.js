'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('complaint_attachments', {
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
      original_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      stored_file_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      size_bytes: {
        type: Sequelize.INTEGER,
        allowNull: false,
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

    await queryInterface.addIndex('complaint_attachments', ['complaint_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('complaint_attachments');
  },
};
