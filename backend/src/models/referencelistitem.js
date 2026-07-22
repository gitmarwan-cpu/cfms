'use strict';

module.exports = (sequelize, DataTypes) => {
  const ReferenceListItem = sequelize.define(
    'ReferenceListItem',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      referenceListId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'reference_list_id',
      },
      code: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      labelAr: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'label_ar',
      },
      labelEn: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'label_en',
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'sort_order',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
      },
      // بيانات إضافية مرنة حسب نوع القائمة (مثال: لون الأولوية، أو
      // forcesSensitive لتصنيفات الشكاوى الحساسة) دون تعديل المخطط مستقبلاً.
      meta: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'reference_list_items',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['reference_list_id', 'code'] }],
    }
  );

  ReferenceListItem.associate = (models) => {
    ReferenceListItem.belongsTo(models.ReferenceList, {
      foreignKey: 'referenceListId',
      as: 'list',
    });
  };

  return ReferenceListItem;
};
