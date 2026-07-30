'use strict';

/**
 * مجموعات نظامية جاهزة (organization_id = NULL) تُتيح لأي مؤسسة البدء
 * فوراً بتوزيع الأدوار على فرق العمل دون إنشاء مجموعاتها الخاصة من
 * الصفر - يمكن لكل مؤسسة لاحقاً إنشاء مجموعات خاصة بها فوق هذه كنقطة بداية.
 * idempotent (فحص وجود مسبق) بنفس نمط بقية seeders الأدوار/الصلاحيات.
 */
module.exports = {
  up: async (queryInterface) => {
    const [[{ count }]] = await queryInterface.sequelize.query(
      `SELECT COUNT(*)::int FROM groups WHERE organization_id IS NULL;`
    );
    if (count > 0) return;

    const now = new Date();

    const [staffRoleRows] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE code = 'staff' AND organization_id IS NULL LIMIT 1;`
    );
    if (staffRoleRows.length === 0) {
      throw new Error('دور staff النظامي غير موجود - تأكد من تشغيل migration الأدوار قبل هذا الـ seeder');
    }
    const staffRoleId = staffRoleRows[0].id;

    const [groupRows] = await queryInterface.sequelize.query(
      `
      INSERT INTO groups (code, name_ar, name_en, description, is_system, is_active, created_at, updated_at)
      VALUES ('complaint_officers', 'موظفو معالجة الشكاوى', 'Complaint Officers',
              'مجموعة جاهزة لفريق استقبال ومعالجة الشكاوى', true, true, :now, :now)
      RETURNING id;
      `,
      { replacements: { now } }
    );
    const groupId = groupRows[0].id;

    await queryInterface.sequelize.query(
      `INSERT INTO group_roles (group_id, role_id, created_at) VALUES (:groupId, :staffRoleId, :now);`,
      { replacements: { groupId, staffRoleId, now } }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`DELETE FROM groups WHERE code = 'complaint_officers';`);
  },
};
