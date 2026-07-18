'use strict';

module.exports = (sequelize, DataTypes) => {
  const District = sequelize.define(
    'District',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nameEn: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'name_en',
      },
      nameAr: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'name_ar',
      },
      governorateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'governorate_id',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'districts',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['governorate_id', 'name_en'],
          name: 'districts_gov_name_en_unique',
        },
      ],
    }
  );

  District.associate = (models) => {
    District.belongsTo(models.Governorate, {
      foreignKey: 'governorateId',
      as: 'governorate',
    });
    District.hasMany(models.Complaint, {
      foreignKey: 'districtId',
      as: 'complaints',
    });
  };

  return District;
};
