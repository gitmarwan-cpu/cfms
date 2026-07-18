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
      role: {
        type: DataTypes.ENUM('admin', 'staff'),
        allowNull: false,
        defaultValue: 'staff',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
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
  };

  return User;
};
