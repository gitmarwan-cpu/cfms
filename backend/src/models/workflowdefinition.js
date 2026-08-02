'use strict';

module.exports = (sequelize, DataTypes) => {
  const WorkflowDefinition = sequelize.define(
    'WorkflowDefinition',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(60), allowNull: false },
      // NULL = تعريف نظامي متاح لكل المؤسسات؛ قيمة = تعريف خاص بمؤسسة معينة
      organizationId: { type: DataTypes.INTEGER, allowNull: true, field: 'organization_id' },
      nameAr: { type: DataTypes.STRING(100), allowNull: false, field: 'name_ar' },
      nameEn: { type: DataTypes.STRING(100), allowNull: true, field: 'name_en' },
      entityType: { type: DataTypes.STRING(60), allowNull: false, field: 'entity_type' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'workflow_definitions',
      underscored: true,
      timestamps: true,
    }
  );

  WorkflowDefinition.associate = (models) => {
    WorkflowDefinition.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    WorkflowDefinition.hasMany(models.WorkflowState, { foreignKey: 'workflowDefinitionId', as: 'states' });
    WorkflowDefinition.hasMany(models.WorkflowTransition, {
      foreignKey: 'workflowDefinitionId',
      as: 'transitions',
    });
  };

  return WorkflowDefinition;
};
