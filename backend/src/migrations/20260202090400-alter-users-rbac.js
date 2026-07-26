'use strict';

/**
 * يزيل هذا الـ migration عمود users.role الثابت (ENUM) بعد ترحيل بياناته
 * إلى الجدولين الجديدين roles/user_roles، ويضيف org_unit_id لربط المستخدم
 * بوحدته التنظيمية (فرع/قسم) بحسب بند "خامساً/سادساً" في التوجيه المعماري.
 *
 * الأدوار الأساسية (admin/staff) تُزرع هنا مباشرة داخل نفس الـ migration
 * (وليس عبر seeder منفصل) لضمان أن عملية الـ Backfill لا تعتمد على ترتيب
 * تشغيل seed:all بعد migrate — وهي نفس الثغرة المحتملة الموجودة في
 * migration الأعمدة المرجعية للشكاوى (20260201090500)، وتم تجنّبها هنا
 * عمداً لأن هذا الجدول (users) قد يحتوي بيانات فعلية منذ الآن.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      // 1) إضافة org_unit_id
      await queryInterface.addColumn(
        'users',
        'org_unit_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'org_units', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction: t }
      );

      // 2) زرع الدورين الأساسيين بأمان (idempotent) عبر ON CONFLICT
      const now = new Date();
      await queryInterface.sequelize.query(
        `
        INSERT INTO roles (code, name_ar, name_en, description, is_system, is_active, created_at, updated_at)
        VALUES
          ('admin', 'مدير النظام', 'Administrator', 'صلاحيات كاملة على المؤسسة والنظام', true, true, :now, :now),
          ('staff', 'موظف', 'Staff', 'صلاحيات أساسية لموظفي المعالجة', true, true, :now, :now)
        ON CONFLICT (code) DO NOTHING;
        `,
        { replacements: { now }, transaction: t }
      );

      const roleRows = await queryInterface.sequelize.query(`SELECT id, code FROM roles WHERE code IN ('admin','staff');`, {
        type: queryInterface.sequelize.QueryTypes.SELECT,
        transaction: t,
      });
      const roleIdByCode = roleRows.reduce((acc, r) => ({ ...acc, [r.code]: r.id }), {});

      // 3) Backfill: كل مستخدم حالي يحصل على صف في user_roles يطابق دوره القديم
      await queryInterface.sequelize.query(
        `
        INSERT INTO user_roles (user_id, role_id, org_unit_id, created_at, updated_at)
        SELECT u.id,
               CASE WHEN u.role = 'admin' THEN :adminRoleId ELSE :staffRoleId END,
               NULL,
               :now, :now
        FROM users u
        ON CONFLICT DO NOTHING;
        `,
        {
          replacements: { adminRoleId: roleIdByCode.admin, staffRoleId: roleIdByCode.staff, now },
          transaction: t,
        }
      );

      // 4) حذف العمود الثابت القديم ونوعه
      await queryInterface.removeColumn('users', 'role', { transaction: t });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";', { transaction: t });
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        'users',
        'role',
        { type: Sequelize.ENUM('admin', 'staff'), allowNull: false, defaultValue: 'staff' },
        { transaction: t }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE users u
        SET role = CASE WHEN EXISTS (
          SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.id AND r.code = 'admin'
        ) THEN 'admin' ELSE 'staff' END;
        `,
        { transaction: t }
      );

      await queryInterface.removeColumn('users', 'org_unit_id', { transaction: t });
    });
  },
};
