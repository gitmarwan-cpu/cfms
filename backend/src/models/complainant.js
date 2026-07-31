'use strict';

module.exports = (sequelize, DataTypes) => {
  const Complainant = sequelize.define(
    'Complainant',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      organizationId: { type: DataTypes.INTEGER, allowNull: false, field: 'organization_id' },
      fullName: { type: DataTypes.STRING(150), allowNull: true, field: 'full_name' },
      phone: { type: DataTypes.STRING(30), allowNull: true },
      email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
      genderItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'gender_item_id' },
      ageGroupItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'age_group_item_id' },
      // علاقة مقدّم الطلب بالمؤسسة (مستفيد/فرد من المجتمع/موظف/...) - راجع
      // reference_lists بالمفتاح 'complainant_relationship'. اختياري دائماً.
      relationshipItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'relationship_item_id' },
      beneficiaryExternalId: { type: DataTypes.STRING(100), allowNull: true, field: 'beneficiary_external_id' },
    },
    {
      tableName: 'complainants',
      underscored: true,
      timestamps: true,
    }
  );

  Complainant.associate = (models) => {
    Complainant.belongsTo(models.Organization, { foreignKey: 'organizationId', as: 'organization' });
    Complainant.belongsTo(models.ReferenceListItem, { foreignKey: 'genderItemId', as: 'genderItem' });
    Complainant.belongsTo(models.ReferenceListItem, { foreignKey: 'ageGroupItemId', as: 'ageGroupItem' });
    Complainant.belongsTo(models.ReferenceListItem, { foreignKey: 'relationshipItemId', as: 'relationshipItem' });
    Complainant.hasMany(models.Complaint, { foreignKey: 'complainantId', as: 'complaints' });
  };

  return Complainant;
};
