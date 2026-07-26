'use strict';

module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define(
    'UserRole',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
      roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'role_id' },
      // إلزامي الآن بعد اعتماد M:N صريحة بين User وOrganization: كل تعيين
      // دور يجب أن يحدد صراحة ضمن أي مؤسسة هو سارٍ.
      organizationId: { type: DataTypes.INTEGER, allowNull: false, field: 'organization_id' },
      // NULL = الدور ساري على مستوى المؤسسة كاملة؛ قيمة = مقصور على تلك الوحدة فقط
      orgUnitId: { type: DataTypes.INTEGER, allowNull: true, field: 'org_unit_id' },
    },
    {
      tableName: 'user_roles',
      underscored: true,
      timestamps: true,
    }
  );

  UserRole.associate = (models) => {
    UserRole.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    UserRole.belongsTo(models.Role, { foreignKey: 'roleId', as: 'role' });
    UserRole.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    UserRole.belongsTo(models.OrgUnit, { foreignKey: 'orgUnitId', as: 'orgUnit' });
  };

  return UserRole;
};
