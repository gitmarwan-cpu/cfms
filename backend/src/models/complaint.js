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
      // إلزامي: كل شكوى تتبع مؤسسة محددة (عزل بيانات متعدد المؤسسات).
      // لا يجوز الاستعلام عن complaints دون تصفية بهذا الحقل - راجع
      // utils/tenantScope.js وcomplaintService.js.
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'organization_id',
      },
      // فصل معماري: مقدّم الشكوى ليس مستخدم نظام. NULL = شكوى مجهولة
      // بالكامل بلا أي بيانات هوية على الإطلاق.
      complainantId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'complainant_id',
      },
      // PIN آمن (bcrypt hash فقط، لا يُخزَّن كنص صريح أبداً) يُستخدم مع
      // referenceCode لمتابعة الشكوى دون تسجيل دخول - راجع utils/pin.js
      trackingPinHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'tracking_pin_hash',
      },
      // NULL = المستفيد قدّم الشكوى بنفسه عبر البوابة العامة؛ قيمة = موظف
      // نظام أدخلها نيابة عنه (حالة حضورية/هاتفية عبر لوحة الإدارة).
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by_user_id',
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
      // ملاحظة: لا يوجد phone/email هنا عمداً - نُقلا بالكامل إلى Complainant
      // (فصل معماري: مقدّم الشكوى ليس عمود مباشر في جدول complaints).
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
    Complaint.belongsTo(models.Organization, {
      foreignKey: 'organizationId',
      as: 'organization',
    });
    Complaint.belongsTo(models.Complainant, {
      foreignKey: 'complainantId',
      as: 'complainant',
    });
    Complaint.belongsTo(models.User, {
      foreignKey: 'createdByUserId',
      as: 'createdBy',
    });
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
