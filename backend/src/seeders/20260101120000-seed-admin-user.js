'use strict';

const bcrypt = require('bcryptjs');

/**
 * ينشئ مستخدماً إدارياً افتراضياً للاختبار الأولي فقط.
 * يجب تغيير كلمة المرور فوراً بعد أول تسجيل دخول في أي بيئة إنتاج حقيقية.
 */
module.exports = {
  up: async (queryInterface) => {
    const passwordHash = await bcrypt.hash('ChangeMe#12345', 10);
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        full_name: 'مدير النظام',
        email: 'admin@cfms.local',
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', { email: 'admin@cfms.local' }, {});
  },
};
