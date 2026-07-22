'use strict';

module.exports = (sequelize, DataTypes) => {
  const OrgUnit = sequelize.define(
    'OrgUnit',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      organizationId: { type: DataTypes.INTEGER, allowNull: false, field: 'organization_id' },
      orgUnitTypeId: { type: DataTypes.INTEGER, allowNull: false, field: 'org_unit_type_id' },
      parentId: { type: DataTypes.INTEGER, allowNull: true, field: 'parent_id' },
      name: { type: DataTypes.STRING(200), allowNull: false },
      code: { type: DataTypes.STRING(60), allowNull: true },
      managerUserId: { type: DataTypes.INTEGER, allowNull: true, field: 'manager_user_id' },
      phone: { type: DataTypes.STRING(30), allowNull: true },
      email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
      address: { type: DataTypes.TEXT, allowNull: true },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'org_units',
      underscored: true,
      timestamps: true,
      paranoid: true, // حذف منطقي (soft delete) حسب المتطلبات المعمارية
      deletedAt: 'deleted_at',
    }
  );

  OrgUnit.associate = (models) => {
    OrgUnit.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    OrgUnit.belongsTo(models.OrgUnitType, { foreignKey: 'orgUnitTypeId', as: 'unitType' });
    OrgUnit.belongsTo(models.OrgUnit, { foreignKey: 'parentId', as: 'parent' });
    OrgUnit.hasMany(models.OrgUnit, { foreignKey: 'parentId', as: 'children' });
    OrgUnit.belongsTo(models.User, { foreignKey: 'managerUserId', as: 'manager' });
  };

  return OrgUnit;
};
