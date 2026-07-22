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
      // الجنس والفئة العمرية أصبحا يشيران إلى reference_list_items (قوائم gender/age_group)
      // بدل ENUM ثابت، لتكون قابلة للإدارة من لوحة الإدارة دون تعديل الكود.
      genderItemId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'gender_item_id',
      },
      ageGroupItemId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'age_group_item_id',
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
      // تصنيف الشكوى/المقترح - يشير إلى reference_list_items (قائمة complaint_category)
      categoryItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'category_item_id',
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
      // قناة استلام الطلب - يشير إلى reference_list_items (قائمة channel)
      channelItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'channel_item_id',
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
    Complaint.belongsTo(models.ReferenceListItem, { foreignKey: 'genderItemId', as: 'genderItem' });
    Complaint.belongsTo(models.ReferenceListItem, { foreignKey: 'ageGroupItemId', as: 'ageGroupItem' });
    Complaint.belongsTo(models.ReferenceListItem, { foreignKey: 'categoryItemId', as: 'categoryItem' });
    Complaint.belongsTo(models.ReferenceListItem, { foreignKey: 'channelItemId', as: 'channelItem' });
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
