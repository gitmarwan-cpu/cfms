'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('complaints', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      reference_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      type: {
        type: Sequelize.ENUM('complaint', 'proposal'),
        allowNull: false,
      },
      is_anonymous: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      full_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      gender: {
        type: Sequelize.ENUM('male', 'female'),
        allowNull: true,
      },
      age_group: {
        type: Sequelize.ENUM('under_18', '18_30', '31_45', '46_60', 'above_60'),
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
      governorate_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'governorates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      district_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'districts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      village: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      category: {
        type: Sequelize.ENUM(
          'service_quality',
          'staff_behavior',
          'corruption_fraud',
          'distribution_issue',
          'protection_gbv',
          'suggestion',
          'other'
        ),
        allowNull: false,
      },
      is_sensitive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      desired_resolution: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      channel: {
        type: Sequelize.ENUM(
          'in_person',
          'hotline',
          'suggestion_box',
          'email',
          'field_visit',
          'website'
        ),
        allowNull: false,
        defaultValue: 'website',
      },
      status: {
        type: Sequelize.ENUM('new', 'in_review', 'resolved', 'closed', 'rejected'),
        allowNull: false,
        defaultValue: 'new',
      },
      consent_given: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      assigned_to_user_id: {
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
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('complaints', ['governorate_id']);
    await queryInterface.addIndex('complaints', ['district_id']);
    await queryInterface.addIndex('complaints', ['status']);
    await queryInterface.addIndex('complaints', ['is_sensitive']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('complaints');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_age_group";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_category";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_channel";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_complaints_status";');
  },
};
