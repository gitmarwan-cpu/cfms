'use strict';

module.exports = (sequelize, DataTypes) => {
  const UserGroup = sequelize.define(
    'UserGroup',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
      groupId: { type: DataTypes.INTEGER, allowNull: false, field: 'group_id' },
      organizationId: { type: DataTypes.INTEGER, allowNull: false, field: 'organization_id' },
    },
    {
      tableName: 'user_groups',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['user_id', 'group_id', 'organization_id'] }],
    }
  );

  UserGroup.associate = (models) => {
    UserGroup.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    UserGroup.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group' });
    UserGroup.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
  };

  return UserGroup;
};
