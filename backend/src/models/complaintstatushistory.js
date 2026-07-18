'use strict';

module.exports = (sequelize, DataTypes) => {
  const ComplaintStatusHistory = sequelize.define(
    'ComplaintStatusHistory',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      complaintId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'complaint_id',
      },
      fromStatus: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'from_status',
      },
      toStatus: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'to_status',
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      changedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'changed_by_user_id',
      },
    },
    {
      tableName: 'complaint_status_history',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );

  ComplaintStatusHistory.associate = (models) => {
    ComplaintStatusHistory.belongsTo(models.Complaint, {
      foreignKey: 'complaintId',
      as: 'complaint',
    });
    ComplaintStatusHistory.belongsTo(models.User, {
      foreignKey: 'changedByUserId',
      as: 'changedBy',
    });
  };

  return ComplaintStatusHistory;
};
