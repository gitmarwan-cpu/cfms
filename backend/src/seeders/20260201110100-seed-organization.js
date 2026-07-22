'use strict';

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('organizations', [
      {
        legal_name: 'نظام إدارة الشكاوى والمقترحات',
        short_name: 'CFMS',
        logo_url: null,
        favicon_url: null,
        description: 'منصة إدارة الشكاوى والملاحظات والمقترحات',
        vision: null,
        mission: null,
        phone: null,
        email: null,
        website: null,
        country: 'Yemen',
        governorate_id: null,
        city: null,
        address: null,
        latitude: null,
        longitude: null,
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        primary_color: '#0e5f66',
        secondary_color: '#0a464b',
        accent_color: '#c77b3f',
        anonymous_complaints_policy: 'allowed',
        notification_settings: JSON.stringify({}),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('organizations', null, {});
  },
};
