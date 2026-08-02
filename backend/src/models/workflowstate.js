'use strict';

module.exports = (sequelize, DataTypes) => {
  const WorkflowState = sequelize.define(
    'WorkflowState',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      workflowDefinitionId: { type: DataTypes.INTEGER, allowNull: false, field: 'workflow_definition_id' },
      code: { type: DataTypes.STRING(60), allowNull: false },
      nameAr: { type: DataTypes.STRING(100), allowNull: false, field: 'name_ar' },
      nameEn: { type: DataTypes.STRING(100), allowNull: true, field: 'name_en' },
      isInitial: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_initial' },
      isFinal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_final' },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    },
    {
      tableName: 'workflow_states',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['workflow_definition_id', 'code'] }],
    }
  );

  WorkflowState.associate = (models) => {
    WorkflowState.belongsTo(models.WorkflowDefinition, {
      foreignKey: 'workflowDefinitionId',
      as: 'workflowDefinition',
    });
    WorkflowState.hasMany(models.Complaint, { foreignKey: 'workflowStateId', as: 'complaints' });
  };

  return WorkflowState;
};
