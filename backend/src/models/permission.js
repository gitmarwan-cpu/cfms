'use strict';

module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    'Permission',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      module: { type: DataTypes.STRING(60), allowNull: false },
      descriptionAr: { type: DataTypes.STRING(255), allowNull: true, field: 'description_ar' },
    },
    {
      tableName: 'permissions',
      underscored: true,
      timestamps: true,
    }
  );

  Permission.associate = (models) => {
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: 'permissionId',
      otherKey: 'roleId',
      as: 'roles',
    });
  };

  return Permission;
};
