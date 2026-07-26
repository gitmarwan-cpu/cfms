'use strict';

/**
 * كتالوج الصلاحيات الأولي. مكتوب بشكل idempotent عمداً (ON CONFLICT DO NOTHING)
 * بعد الدرس المستفاد من خطأ تكرار seed المحافظات: أي seeder قد يُشغَّل أكثر
 * من مرة على نفس القاعدة (بيئة تطوير، إعادة نشر، CI) ويجب ألا ينكسر.
 *
 * ملاحظة: هذا الكتالوج يشمل صلاحيات لوحدة "إدارة الشكاوى" (complaints.*)
 * تحضيراً للخطوة القادمة (بند عاشراً)، رغم أن الإنفاذ الفعلي لها في الكود
 * سيُضاف عند بناء تلك الوحدة تحديداً — إدراجها الآن لا يُفعّل شيئاً بذاته.
 */

const PERMISSIONS = [
  // organization
  { code: 'organization.view', module: 'organization', description_ar: 'عرض إعدادات المؤسسة' },
  { code: 'organization.manage', module: 'organization', description_ar: 'تعديل إعدادات المؤسسة' },
  // reference data
  { code: 'reference_data.view', module: 'reference_data', description_ar: 'عرض القوائم المرجعية' },
  { code: 'reference_data.manage', module: 'reference_data', description_ar: 'إدارة القوائم المرجعية' },
  // org structure
  { code: 'org_structure.view', module: 'org_structure', description_ar: 'عرض الهيكل التنظيمي' },
  { code: 'org_structure.manage', module: 'org_structure', description_ar: 'إدارة الهيكل التنظيمي' },
  // users & roles
  { code: 'users.view', module: 'users', description_ar: 'عرض المستخدمين' },
  { code: 'users.manage', module: 'users', description_ar: 'إدارة المستخدمين' },
  { code: 'roles.view', module: 'users', description_ar: 'عرض الأدوار والصلاحيات' },
  { code: 'roles.manage', module: 'users', description_ar: 'إدارة الأدوار والصلاحيات' },
  // complaints (تحضيرية للوحدة القادمة)
  { code: 'complaints.view_own', module: 'complaints', description_ar: 'عرض الشكاوى المسندة للمستخدم فقط' },
  { code: 'complaints.view_all', module: 'complaints', description_ar: 'عرض جميع الشكاوى' },
  { code: 'complaints.create', module: 'complaints', description_ar: 'تسجيل شكوى نيابة عن مستفيد (حالة حضورية/هاتفية)' },
  { code: 'complaints.assign', module: 'complaints', description_ar: 'إسناد الشكاوى لموظف/قسم/فريق' },
  { code: 'complaints.transfer', module: 'complaints', description_ar: 'تحويل الشكوى بين الأقسام/الفروع' },
  { code: 'complaints.close', module: 'complaints', description_ar: 'إغلاق الشكوى' },
  { code: 'complaints.escalate', module: 'complaints', description_ar: 'تصعيد الشكوى' },
];

// staff يحصل افتراضياً على مجموعة محدودة فقط؛ يمكن تعديلها لاحقاً من واجهة الإدارة
const STAFF_DEFAULT_CODES = ['organization.view', 'reference_data.view', 'org_structure.view', 'complaints.view_own'];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    const values = PERMISSIONS.map(
      (p) => `('${p.code}', '${p.module}', '${p.description_ar.replace(/'/g, "''")}', :now, :now)`
    ).join(',\n');

    await queryInterface.sequelize.query(
      `
      INSERT INTO permissions (code, module, description_ar, created_at, updated_at)
      VALUES ${values}
      ON CONFLICT (code) DO NOTHING;
      `,
      { replacements: { now } }
    );

    const [roleRows, permissionRows] = await Promise.all([
      queryInterface.sequelize.query(`SELECT id, code FROM roles WHERE code IN ('admin','staff');`, {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }),
      queryInterface.sequelize.query(`SELECT id, code FROM permissions;`, {
        type: queryInterface.sequelize.QueryTypes.SELECT,
      }),
    ]);

    const roleIdByCode = roleRows.reduce((acc, r) => ({ ...acc, [r.code]: r.id }), {});
    const permIdByCode = permissionRows.reduce((acc, p) => ({ ...acc, [p.code]: p.id }), {});

    if (!roleIdByCode.admin || !roleIdByCode.staff) {
      // بيئة لم يُشغَّل فيها migration الأدوار بعد؛ لا شيء يُفعل بأمان هنا
      return;
    }

    const adminMappings = Object.values(permIdByCode).map((permId) => `(${roleIdByCode.admin}, ${permId}, :now)`);
    const staffMappings = STAFF_DEFAULT_CODES.filter((code) => permIdByCode[code]).map(
      (code) => `(${roleIdByCode.staff}, ${permIdByCode[code]}, :now)`
    );

    const allMappings = [...adminMappings, ...staffMappings];
    if (allMappings.length === 0) return;

    await queryInterface.sequelize.query(
      `
      INSERT INTO role_permissions (role_id, permission_id, created_at)
      VALUES ${allMappings.join(',\n')}
      ON CONFLICT ON CONSTRAINT role_permissions_unique DO NOTHING;
      `,
      { replacements: { now } }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('role_permissions', null, {});
    await queryInterface.bulkDelete('permissions', null, {});
  },
};
