'use strict';

module.exports = (sequelize, DataTypes) => {
  const UserOrganization = sequelize.define(
    'UserOrganization',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
      organizationId: { type: DataTypes.INTEGER, allowNull: false, field: 'organization_id' },
      isPrimary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'user_organizations',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['user_id', 'organization_id'] }],
    }
  );

  UserOrganization.associate = (models) => {
    UserOrganization.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    UserOrganization.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
  };

  return UserOrganization;
};
