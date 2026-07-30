'use strict';

module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define(
    'Group',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(60), allowNull: false },
      // NULL = مجموعة نظامية متاحة لكل المؤسسات؛ قيمة = مجموعة خاصة بمؤسسة معينة
      organizationId: { type: DataTypes.INTEGER, allowNull: true, field: 'organization_id' },
      nameAr: { type: DataTypes.STRING(100), allowNull: false, field: 'name_ar' },
      nameEn: { type: DataTypes.STRING(100), allowNull: true, field: 'name_en' },
      description: { type: DataTypes.TEXT, allowNull: true },
      isSystem: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_system' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'groups',
      underscored: true,
      timestamps: true,
    }
  );

  Group.associate = (models) => {
    Group.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    Group.belongsToMany(models.Role, {
      through: models.GroupRole,
      foreignKey: 'groupId',
      otherKey: 'roleId',
      as: 'roles',
    });
    Group.hasMany(models.UserGroup, { foreignKey: 'groupId', as: 'userGroups' });
  };

  return Group;
};
