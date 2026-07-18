'use strict';

module.exports = (sequelize, DataTypes) => {
  const Complaint = sequelize.define(
    'Complaint',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      referenceCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        field: 'reference_code',
      },
      // نوع الطلب: شكوى أو مقترح
      type: {
        type: DataTypes.ENUM('complaint', 'proposal'),
        allowNull: false,
      },
      // هل مقدم الطلب يفضّل عدم الإفصاح عن هويته
      isAnonymous: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_anonymous',
      },
      fullName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'full_name',
      },
      gender: {
        type: DataTypes.ENUM('male', 'female'),
        allowNull: true,
      },
      ageGroup: {
        type: DataTypes.ENUM('under_18', '18_30', '31_45', '46_60', 'above_60'),
        allowNull: true,
        field: 'age_group',
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: true,
        validate: { isEmail: true },
      },
      governorateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'governorate_id',
      },
      districtId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'district_id',
      },
      village: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      // تصنيف الشكوى/المقترح
      category: {
        type: DataTypes.ENUM(
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
      // شكوى حساسة تتطلب مسار سرّي خاص
      isSensitive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_sensitive',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      desiredResolution: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'desired_resolution',
      },
      // قناة استلام الطلب
      channel: {
        type: DataTypes.ENUM(
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
        type: DataTypes.ENUM('new', 'in_review', 'resolved', 'closed', 'rejected'),
        allowNull: false,
        defaultValue: 'new',
      },
      consentGiven: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'consent_given',
      },
      assignedToUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'assigned_to_user_id',
      },
    },
    {
      tableName: 'complaints',
      underscored: true,
      timestamps: true,
    }
  );

  Complaint.associate = (models) => {
    Complaint.belongsTo(models.Governorate, {
      foreignKey: 'governorateId',
      as: 'governorate',
    });
    Complaint.belongsTo(models.District, {
      foreignKey: 'districtId',
      as: 'district',
    });
    Complaint.belongsTo(models.User, {
      foreignKey: 'assignedToUserId',
      as: 'assignedTo',
    });
    Complaint.hasMany(models.ComplaintAttachment, {
      foreignKey: 'complaintId',
      as: 'attachments',
      onDelete: 'CASCADE',
    });
    Complaint.hasMany(models.ComplaintStatusHistory, {
      foreignKey: 'complaintId',
      as: 'statusHistory',
      onDelete: 'CASCADE',
    });
  };

  return Complaint;
};
