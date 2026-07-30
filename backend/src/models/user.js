'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      fullName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'full_name',
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'password_hash',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      orgUnitId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'org_unit_id',
      },
      // مؤسسة المستخدم الافتراضية (إلزامية منطقياً لأي مستخدم جديد عدا
      // المدير الأول في Bootstrap) - مؤشر سريع فوق user_organizations،
      // لا يُلغي علاقة M:N الفعلية.
      defaultOrganizationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'default_organization_id',
      },
    },
    {
      tableName: 'users',
      underscored: true,
      timestamps: true,
      defaultScope: {
        attributes: { exclude: ['passwordHash'] },
      },
      scopes: {
        withPassword: {
          attributes: { include: ['passwordHash'] },
        },
      },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Complaint, {
      foreignKey: 'assignedToUserId',
      as: 'assignedComplaints',
    });
    User.hasMany(models.ComplaintStatusHistory, {
      foreignKey: 'changedByUserId',
      as: 'statusChanges',
    });
    User.belongsTo(models.OrgUnit, { foreignKey: 'orgUnitId', as: 'orgUnit' });
    User.belongsTo(models.Organization, { foreignKey: 'defaultOrganizationId', as: 'defaultOrganization' });
    User.hasMany(models.UserRole, { foreignKey: 'userId', as: 'userRoles' });
    User.hasMany(models.UserGroup, { foreignKey: 'userId', as: 'userGroups' });
    User.belongsToMany(models.Organization, {
      through: models.UserOrganization,
      foreignKey: 'userId',
      otherKey: 'organizationId',
      as: 'organizations',
    });
    User.hasMany(models.UserOrganization, { foreignKey: 'userId', as: 'organizationMemberships' });
  };

  return User;
};
