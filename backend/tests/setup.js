'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_jest_only';
process.env.JWT_EXPIRES_IN = '1h';

const {
  sequelize,
  Country,
  Governorate,
  District,
  Organization,
  UserOrganization,
  ReferenceList,
  ReferenceListItem,
  Role,
  Permission,
  UserRole,
  Group,
  User,
} = require('../src/models');
const bcrypt = require('bcryptjs');

const REFERENCE_SEED = [
  {
    key: 'gender',
    nameAr: 'الجنس',
    items: [
      { code: 'male', labelAr: 'ذكر' },
      { code: 'female', labelAr: 'أنثى' },
    ],
  },
  {
    key: 'age_group',
    nameAr: 'الفئة العمرية',
    items: [
      { code: 'under_18', labelAr: 'أقل من 18' },
      { code: '18_30', labelAr: '18 - 30' },
      { code: '31_45', labelAr: '31 - 45' },
      { code: '46_60', labelAr: '46 - 60' },
      { code: 'above_60', labelAr: 'أكثر من 60' },
    ],
  },
  {
    key: 'complaint_category',
    nameAr: 'تصنيف الشكوى',
    items: [
      { code: 'service_quality', labelAr: 'جودة الخدمة' },
      { code: 'staff_behavior', labelAr: 'سلوك موظف' },
      { code: 'corruption_fraud', labelAr: 'فساد / احتيال' },
      { code: 'distribution_issue', labelAr: 'مشكلة في التوزيع' },
      { code: 'protection_gbv', labelAr: 'حماية / عنف قائم على النوع الاجتماعي' },
      { code: 'suggestion', labelAr: 'مقترح تحسين' },
      { code: 'other', labelAr: 'أخرى' },
    ],
  },
  {
    key: 'channel',
    nameAr: 'قناة الاستلام',
    items: [
      { code: 'website', labelAr: 'الموقع الإلكتروني', isDefault: true },
      { code: 'in_person', labelAr: 'حضوري' },
      { code: 'hotline', labelAr: 'الخط الساخن' },
      { code: 'suggestion_box', labelAr: 'صندوق الاقتراحات' },
      { code: 'email', labelAr: 'البريد الإلكتروني' },
      { code: 'field_visit', labelAr: 'زيارة ميدانية' },
    ],
  },
];

let seedGovernorateId;
let seedCountryId;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // الدولة إلزامية الآن لأي محافظة (بعد إضافة countries) - راجع migrations/20260204*
  const yemen = await Country.create({ iso2: 'YE', iso3: 'YEM', nameAr: 'اليمن', nameEn: 'Yemen' });
  seedCountryId = yemen.id;

  // بيانات أولية كافية للاختبارات: محافظتان ومديريات تابعة لهما
  const ibb = await Governorate.create({ nameEn: 'Ibb', nameAr: 'إب', countryId: yemen.id });
  const abyan = await Governorate.create({ nameEn: 'Abyan', nameAr: 'أبين', countryId: yemen.id });
  seedGovernorateId = ibb.id;

  await District.bulkCreate([
    { nameEn: 'Al Qafr', nameAr: 'القفر', governorateId: ibb.id },
    { nameEn: 'Yarim', nameAr: 'يريم', governorateId: ibb.id },
    { nameEn: 'Ahwar', nameAr: 'أحور', governorateId: abyan.id },
  ]);

  // زرع البيانات المرجعية النظامية (organizationId = null = Template متاح لكل المؤسسات)
  for (const list of REFERENCE_SEED) {
    const createdList = await ReferenceList.create({
      key: list.key,
      nameAr: list.nameAr,
      isSystem: true,
      organizationId: null,
    });
    await ReferenceListItem.bulkCreate(
      list.items.map((item, index) => ({
        referenceListId: createdList.id,
        code: item.code,
        labelAr: item.labelAr,
        sortOrder: index + 1,
        isActive: true,
        isDefault: !!item.isDefault,
      }))
    );
  }

  // زرع أدوار وصلاحيات RBAC النظامية (organizationId = null = متاحة لكل المؤسسات)
  const adminRole = await Role.create({ code: 'admin', nameAr: 'مدير النظام', isSystem: true, organizationId: null });
  const staffRole = await Role.create({ code: 'staff', nameAr: 'موظف', isSystem: true, organizationId: null });

  const permissionCodes = [
    'organization.view',
    'organization.manage',
    'reference_data.view',
    'reference_data.manage',
    'org_structure.view',
    'org_structure.manage',
    'users.view',
    'users.manage',
    'roles.view',
    'roles.manage',
    'groups.view',
    'groups.manage',
    'complaints.view_own',
    'complaints.view_all',
    'complaints.create',
    'complaints.assign',
    'complaints.transfer',
    'complaints.close',
    'complaints.escalate',
  ];
  const permissions = await Permission.bulkCreate(
    permissionCodes.map((code) => ({ code, module: code.split('.')[0] })),
    { returning: true }
  );
  await adminRole.setPermissions(permissions.map((p) => p.id));
  await staffRole.setPermissions(
    permissions.filter((p) => ['complaints.view_own'].includes(p.code)).map((p) => p.id)
  );

  global.__rbacRoles = { adminRole, staffRole };

  // مجموعة نظامية للاختبار (تطابق ما يزرعه seed-system-groups.js فعلياً)
  const systemGroup = await Group.create({
    code: 'complaint_officers',
    nameAr: 'موظفو معالجة الشكاوى',
    isSystem: true,
    organizationId: null,
  });
  await systemGroup.setRoles([staffRole.id]);

  // مؤسسة افتراضية لمعظم الاختبارات الحالية (سلوك أحادي المؤسسة كما كان)
  global.__defaultOrg = await Organization.create({
    legalName: 'مؤسسة الاختبار',
    shortName: 'Test Org',
    slug: 'test-org',
    country: 'Yemen',
    governorateId: ibb.id,
    defaultLanguage: 'ar',
    timezone: 'Asia/Aden',
    dateFormat: 'DD/MM/YYYY',
    anonymousComplaintsPolicy: 'allowed',
  });
});

/**
 * ينشئ مؤسسة إضافية (لاختبارات العزل بين المؤسسات - Tenant Isolation Tests).
 */
const createOrganization = async (overrides = {}) => {
  return Organization.create({
    legalName: overrides.legalName || `مؤسسة ${Date.now()}`,
    shortName: overrides.shortName || 'Org',
    slug: overrides.slug || `org-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    country: 'Yemen',
    governorateId: seedGovernorateId,
    defaultLanguage: 'ar',
    timezone: 'Asia/Aden',
    dateFormat: 'DD/MM/YYYY',
    anonymousComplaintsPolicy: 'allowed',
  });
};

/**
 * ينشئ مستخدماً ضمن مؤسسة معينة (افتراضياً مؤسسة الاختبار العامة)، مع
 * عضوية فعلية (user_organizations) وتعيين دور مُسند صراحة ضمن نفس
 * المؤسسة (user_roles.organizationId إلزامي)، ويضبط defaultOrganizationId.
 */
const createUserWithRole = async (
  { fullName, email, roleCode = 'staff', organizationId = null, orgUnitId = null },
  rawPassword = 'Password123'
) => {
  const targetOrgId = organizationId || global.__defaultOrg.id;
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const user = await User.create({ fullName, email, passwordHash, orgUnitId, defaultOrganizationId: targetOrgId });
  const role = roleCode === 'admin' ? global.__rbacRoles.adminRole : global.__rbacRoles.staffRole;

  await UserOrganization.create({ userId: user.id, organizationId: targetOrgId, isPrimary: true, isActive: true });
  await UserRole.create({ userId: user.id, roleId: role.id, organizationId: targetOrgId, orgUnitId });

  return { user, rawPassword, organizationId: targetOrgId };
};

afterAll(async () => {
  await sequelize.close();
});

module.exports = {
  sequelize,
  createUserWithRole,
  createOrganization,
  getDefaultOrg: () => global.__defaultOrg,
  getSeedGovernorateId: () => seedGovernorateId,
  getSeedCountryId: () => seedCountryId,
};
