'use strict';

module.exports = (sequelize, DataTypes) => {
  const Country = sequelize.define(
    'Country',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      iso2: { type: DataTypes.STRING(2), allowNull: false, unique: true },
      iso3: { type: DataTypes.STRING(3), allowNull: true, unique: true },
      nameAr: { type: DataTypes.STRING(150), allowNull: false, field: 'name_ar' },
      nameEn: { type: DataTypes.STRING(150), allowNull: false, field: 'name_en' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'countries',
      underscored: true,
      timestamps: true,
    }
  );

  Country.associate = (models) => {
    Country.hasMany(models.Governorate, { foreignKey: 'countryId', as: 'governorates', onDelete: 'RESTRICT' });
  };

  return Country;
};
