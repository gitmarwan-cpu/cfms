'use strict';

module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'Role',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(60), allowNull: false },
      // NULL = دور نظامي متاح لكل المؤسسات (admin/staff)؛ قيمة = دور مخصص
      // أنشأته مؤسسة معينة فقط. الفريدة الفعلية (code, organization_id) على DB.
      organizationId: { type: DataTypes.INTEGER, allowNull: true, field: 'organization_id' },
      nameAr: { type: DataTypes.STRING(100), allowNull: false, field: 'name_ar' },
      nameEn: { type: DataTypes.STRING(100), allowNull: true, field: 'name_en' },
      description: { type: DataTypes.TEXT, allowNull: true },
      isSystem: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_system' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'roles',
      underscored: true,
      timestamps: true,
    }
  );

  Role.associate = (models) => {
    Role.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: 'roleId',
      otherKey: 'permissionId',
      as: 'permissions',
    });
    Role.hasMany(models.UserRole, { foreignKey: 'roleId', as: 'userRoles' });
  };

  return Role;
};
