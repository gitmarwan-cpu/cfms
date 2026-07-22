'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('organizations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      legal_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      short_name: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      logo_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      favicon_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      vision: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      mission: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      website: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Yemen',
      },
      governorate_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'governorates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      city: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      default_language: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'ar',
      },
      timezone: {
        type: Sequelize.STRING(60),
        allowNull: false,
        defaultValue: 'Asia/Aden',
      },
      date_format: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'DD/MM/YYYY',
      },
      primary_color: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '#0e5f66',
      },
      secondary_color: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '#0a464b',
      },
      accent_color: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '#c77b3f',
      },
      anonymous_complaints_policy: {
        type: Sequelize.ENUM('allowed', 'not_allowed', 'optional'),
        allowNull: false,
        defaultValue: 'allowed',
      },
      notification_settings: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
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
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('organizations');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_organizations_anonymous_complaints_policy";'
    );
  },
};
