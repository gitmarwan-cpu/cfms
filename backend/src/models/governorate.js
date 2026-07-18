'use strict';

module.exports = (sequelize, DataTypes) => {
  const Governorate = sequelize.define(
    'Governorate',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nameEn: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        field: 'name_en',
      },
      nameAr: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'name_ar',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'governorates',
      underscored: true,
      timestamps: true,
    }
  );

  Governorate.associate = (models) => {
    Governorate.hasMany(models.District, {
      foreignKey: 'governorateId',
      as: 'districts',
      onDelete: 'RESTRICT',
    });
    Governorate.hasMany(models.Complaint, {
      foreignKey: 'governorateId',
      as: 'complaints',
    });
  };

  return Governorate;
};
