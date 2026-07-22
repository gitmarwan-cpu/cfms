'use strict';

module.exports = (sequelize, DataTypes) => {
  const OrgUnitType = sequelize.define(
    'OrgUnitType',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      organizationId: { type: DataTypes.INTEGER, allowNull: false, field: 'organization_id' },
      code: { type: DataTypes.STRING(60), allowNull: false },
      nameAr: { type: DataTypes.STRING(100), allowNull: false, field: 'name_ar' },
      nameEn: { type: DataTypes.STRING(100), allowNull: true, field: 'name_en' },
      hierarchyLevel: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'hierarchy_level' },
      allowedParentTypeId: { type: DataTypes.INTEGER, allowNull: true, field: 'allowed_parent_type_id' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'org_unit_types',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['organization_id', 'code'] }],
    }
  );

  OrgUnitType.associate = (models) => {
    OrgUnitType.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    OrgUnitType.belongsTo(models.OrgUnitType, { foreignKey: 'allowedParentTypeId', as: 'allowedParentType' });
    OrgUnitType.hasMany(models.OrgUnitType, { foreignKey: 'allowedParentTypeId', as: 'childTypes' });
    OrgUnitType.hasMany(models.OrgUnit, { foreignKey: 'orgUnitTypeId', as: 'units' });
  };

  return OrgUnitType;
};
