'use strict';

module.exports = (sequelize, DataTypes) => {
  const GroupRole = sequelize.define(
    'GroupRole',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      groupId: { type: DataTypes.INTEGER, allowNull: false, field: 'group_id' },
      roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'role_id' },
    },
    {
      tableName: 'group_roles',
      underscored: true,
      timestamps: true,
      updatedAt: false,
      indexes: [{ unique: true, fields: ['group_id', 'role_id'] }],
    }
  );

  return GroupRole;
};
