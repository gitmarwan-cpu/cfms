'use strict';

module.exports = (sequelize, DataTypes) => {
  const Organization = sequelize.define(
    'Organization',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      legalName: { type: DataTypes.STRING(200), allowNull: false, field: 'legal_name' },
      shortName: { type: DataTypes.STRING(80), allowNull: true, field: 'short_name' },
      logoUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'logo_url' },
      faviconUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'favicon_url' },
      description: { type: DataTypes.TEXT, allowNull: true },
      vision: { type: DataTypes.TEXT, allowNull: true },
      mission: { type: DataTypes.TEXT, allowNull: true },
      phone: { type: DataTypes.STRING(30), allowNull: true },
      email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
      website: { type: DataTypes.STRING(255), allowNull: true },
      country: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Yemen' },
      governorateId: { type: DataTypes.INTEGER, allowNull: true, field: 'governorate_id' },
      city: { type: DataTypes.STRING(150), allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      defaultLanguage: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ar', field: 'default_language' },
      timezone: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Asia/Aden' },
      dateFormat: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'DD/MM/YYYY', field: 'date_format' },
      primaryColor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#0e5f66', field: 'primary_color' },
      secondaryColor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#0a464b', field: 'secondary_color' },
      accentColor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '#c77b3f', field: 'accent_color' },
      anonymousComplaintsPolicy: {
        type: DataTypes.ENUM('allowed', 'not_allowed', 'optional'),
        allowNull: false,
        defaultValue: 'allowed',
        field: 'anonymous_complaints_policy',
      },
      notificationSettings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        field: 'notification_settings',
      },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    },
    {
      tableName: 'organizations',
      underscored: true,
      timestamps: true,
    }
  );

  Organization.associate = (models) => {
    Organization.belongsTo(models.Governorate, { foreignKey: 'governorateId', as: 'governorate' });
    Organization.hasMany(models.OrgUnitType, { foreignKey: 'organizationId', as: 'unitTypes' });
    Organization.hasMany(models.OrgUnit, { foreignKey: 'organizationId', as: 'units' });
  };

  return Organization;
};
