'use strict';

module.exports = (sequelize, DataTypes) => {
  const WorkflowTransition = sequelize.define(
    'WorkflowTransition',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      workflowDefinitionId: { type: DataTypes.INTEGER, allowNull: false, field: 'workflow_definition_id' },
      // NULL = الانتقال مسموح من أي حالة حالية
      fromStateId: { type: DataTypes.INTEGER, allowNull: true, field: 'from_state_id' },
      toStateId: { type: DataTypes.INTEGER, allowNull: false, field: 'to_state_id' },
      code: { type: DataTypes.STRING(60), allowNull: false },
      nameAr: { type: DataTypes.STRING(100), allowNull: false, field: 'name_ar' },
      nameEn: { type: DataTypes.STRING(100), allowNull: true, field: 'name_en' },
      // كود صلاحية اختياري (نص حر) - يُتحقَّق منه فعلياً في طبقة التنفيذ
      // اللاحقة (خارج نطاق هذه الدفعة: قاعدة بيانات فقط، بلا منطق تنفيذ).
      requiresPermission: { type: DataTypes.STRING(100), allowNull: true, field: 'requires_permission' },
    },
    {
      tableName: 'workflow_transitions',
      underscored: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['workflow_definition_id', 'code'] }],
    }
  );

  WorkflowTransition.associate = (models) => {
    WorkflowTransition.belongsTo(models.WorkflowDefinition, {
      foreignKey: 'workflowDefinitionId',
      as: 'workflowDefinition',
    });
    WorkflowTransition.belongsTo(models.WorkflowState, { foreignKey: 'fromStateId', as: 'fromState' });
    WorkflowTransition.belongsTo(models.WorkflowState, { foreignKey: 'toStateId', as: 'toState' });
  };

  return WorkflowTransition;
};
