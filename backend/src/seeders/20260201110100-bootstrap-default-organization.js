'use strict';

const bcrypt = require('bcryptjs');

/**
 * ============================================================
 * Bootstrap - يعمل مرة واحدة فقط عند أول تنصيب للمنصة
 * ============================================================
 * لا يُنشئ مؤسسة جديدة تلقائياً لكل مستخدم أو كل تشغيل - يتحقق أولاً أن
 * لا توجد أي مؤسسة على الإطلاق قبل المتابعة (Guard صريح)، وإلا يتوقف
 * بأمان دون فعل شيء. هذا يفصل "التنصيب الأول" عن "SaaS Onboarding"
 * (إنشاء مؤسسة جديدة تلقائياً لكل مستأجر جديد) الذي يبقى مؤجلاً عمداً
 * ويمكن تفعيله لاحقاً عبر service منفصل (organizationOnboardingService)
 * يستدعي نفس منطق الإنشاء أدناه دون تعديل نموذج البيانات الأساسي.
 *
 * كلمة مرور المدير الأول تُقرأ من متغيرات البيئة (BOOTSTRAP_ADMIN_EMAIL /
 * BOOTSTRAP_ADMIN_PASSWORD) وليست مكتوبة كنص صريح في الكود؛ القيم
 * الافتراضية هنا للتطوير المحلي فقط ويجب تغييرها فوراً في الإنتاج.
 */
module.exports = {
  up: async (queryInterface) => {
    const [existingOrgs] = await queryInterface.sequelize.query('SELECT id FROM organizations LIMIT 1;');
    if (existingOrgs.length > 0) {
      // تم التنصيب مسبقاً - لا تُنشئ مؤسسة افتراضية ثانية
      return;
    }

    const now = new Date();

    const [orgRows] = await queryInterface.sequelize.query(
      `
      INSERT INTO organizations (
        legal_name, short_name, slug, description, country, default_language, timezone,
        date_format, primary_color, secondary_color, accent_color, anonymous_complaints_policy,
        notification_settings, is_active, created_at, updated_at
      ) VALUES (
        'المؤسسة الافتراضية', 'Default Org', 'default-org', 'مؤسسة افتراضية تلقائية عند أول تنصيب - يمكن للمدير إعادة تسميتها وتهيئتها',
        'Yemen', 'ar', 'Asia/Aden', 'DD/MM/YYYY', '#0e5f66', '#0a464b', '#c77b3f', 'allowed', '{}', true, :now, :now
      ) RETURNING id;
      `,
      { replacements: { now } }
    );
    const organizationId = orgRows[0].id;

    const [adminRoleRows] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE code = 'admin' AND organization_id IS NULL LIMIT 1;`
    );
    if (adminRoleRows.length === 0) {
      throw new Error(
        'دور admin النظامي غير موجود - تأكد من تشغيل migration الأدوار (20260202090400) قبل هذا الـ seeder'
      );
    }
    const adminRoleId = adminRoleRows[0].id;

    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@cfms.local';
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(bootstrapPassword, 10);

    const [userRows] = await queryInterface.sequelize.query(
      `
      INSERT INTO users (full_name, email, password_hash, is_active, default_organization_id, created_at, updated_at)
      VALUES ('مدير المنصة', :email, :passwordHash, true, :organizationId, :now, :now)
      RETURNING id;
      `,
      { replacements: { email: bootstrapEmail, passwordHash, organizationId, now } }
    );
    const userId = userRows[0].id;

    await queryInterface.sequelize.query(
      `
      INSERT INTO user_organizations (user_id, organization_id, is_primary, is_active, created_at, updated_at)
      VALUES (:userId, :organizationId, true, true, :now, :now);
      `,
      { replacements: { userId, organizationId, now } }
    );

    await queryInterface.sequelize.query(
      `
      INSERT INTO user_roles (user_id, role_id, organization_id, org_unit_id, created_at, updated_at)
      VALUES (:userId, :adminRoleId, :organizationId, NULL, :now, :now);
      `,
      { replacements: { userId, adminRoleId, organizationId, now } }
    );

    if (!process.env.BOOTSTRAP_ADMIN_PASSWORD) {
      // تحذير واضح في سجلات التنصيب - لا يُطبع خطأً بصمت
      // eslint-disable-next-line no-console
      console.warn(
        `\n⚠️  BOOTSTRAP: تم إنشاء المدير الأول ببيانات افتراضية (${bootstrapEmail} / ChangeMe123!). ` +
          'غيّر كلمة المرور فوراً بعد أول تسجيل دخول، أو مرّر BOOTSTRAP_ADMIN_PASSWORD قبل التشغيل في الإنتاج.\n'
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`DELETE FROM organizations WHERE slug = 'default-org';`);
  },
};
