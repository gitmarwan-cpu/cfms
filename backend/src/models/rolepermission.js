'use strict';

module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define(
    'RolePermission',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'role_id' },
      permissionId: { type: DataTypes.INTEGER, allowNull: false, field: 'permission_id' },
    },
    {
      tableName: 'role_permissions',
      underscored: true,
      timestamps: true,
      updatedAt: false,
      indexes: [{ unique: true, fields: ['role_id', 'permission_id'] }],
    }
  );

  return RolePermission;
};
