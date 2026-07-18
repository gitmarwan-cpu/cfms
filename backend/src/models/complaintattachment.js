'use strict';

module.exports = (sequelize, DataTypes) => {
  const ComplaintAttachment = sequelize.define(
    'ComplaintAttachment',
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
      originalName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'original_name',
      },
      storedFileName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'stored_file_name',
      },
      mimeType: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'mime_type',
      },
      sizeBytes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'size_bytes',
      },
    },
    {
      tableName: 'complaint_attachments',
      underscored: true,
      timestamps: true,
    }
  );

  ComplaintAttachment.associate = (models) => {
    ComplaintAttachment.belongsTo(models.Complaint, {
      foreignKey: 'complaintId',
      as: 'complaint',
    });
  };

  return ComplaintAttachment;
};
