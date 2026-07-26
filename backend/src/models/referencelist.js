'use strict';

module.exports = (sequelize, DataTypes) => {
  const ReferenceList = sequelize.define(
    'ReferenceList',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      // NULL = قائمة نظامية متاحة لكل المؤسسات (Template)؛ قيمة = نسخة
      // خاصة بمؤسسة معينة (Override) لا تظهر لغيرها. الفريدة الفعلية هي
      // (key, organization_id) على مستوى قاعدة البيانات، وليس key وحدها.
      organizationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'organization_id',
      },
      nameAr: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'name_ar',
      },
      nameEn: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'name_en',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // القوائم النظامية (مثل الجنس/الفئة العمرية) لا يمكن حذفها بالكامل،
      // فقط تعديل عناصرها، لضمان تكامل الحقول المرتبطة بها في النظام.
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_system',
      },
    },
    {
      tableName: 'reference_lists',
      underscored: true,
      timestamps: true,
    }
  );

  ReferenceList.associate = (models) => {
    ReferenceList.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    ReferenceList.hasMany(models.ReferenceListItem, {
      foreignKey: 'referenceListId',
      as: 'items',
    });
  };

  return ReferenceList;
};
