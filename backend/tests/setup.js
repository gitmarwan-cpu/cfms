'use strict';

require('dotenv').config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_jest_only';
process.env.JWT_EXPIRES_IN = '1h';

const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');
const prisma = require('../src/prisma/client');
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
  {
    key: 'complainant_relationship',
    nameAr: 'علاقة مقدّم الطلب بالمؤسسة',
    items: [
      { code: 'beneficiary', labelAr: 'مستفيد', isDefault: true },
      { code: 'community_member', labelAr: 'فرد من المجتمع' },
      { code: 'visitor', labelAr: 'زائر' },
      { code: 'employee', labelAr: 'موظف' },
      { code: 'contractor', labelAr: 'مقاول' },
      { code: 'service_provider', labelAr: 'مقدّم خدمة' },
      { code: 'partner', labelAr: 'شريك' },
      { code: 'other', labelAr: 'أخرى' },
    ],
  },
  {
    key: 'complaint_priority',
    nameAr: 'أولوية الشكوى',
    items: [
      { code: 'low', labelAr: 'منخفضة' },
      { code: 'medium', labelAr: 'متوسطة', isDefault: true },
      { code: 'high', labelAr: 'حرجة' },
      { code: 'urgent', labelAr: 'حرجة / عاجلة' },
    ],
  },
];

let seedGovernorateId;
let seedCountryId;

const timestamp = () => new Date();

beforeAll(async () => {
  await prepareTestDatabase();

  const yemen = await prisma.countries.create({
    data: {
      iso2: 'YE',
      iso3: 'YEM',
      name_ar: 'اليمن',
      name_en: 'Yemen',
      create_date: timestamp(),
      write_date: timestamp(),
    },
  });
  seedCountryId = yemen.id;

  const ibb = await prisma.governorates.create({
    data: {
      name_en: 'Ibb',
      name_ar: 'إب',
      country_id: yemen.id,
      create_date: timestamp(),
      write_date: timestamp(),
    },
  });
  const abyan = await prisma.governorates.create({
    data: {
      name_en: 'Abyan',
      name_ar: 'أبين',
      country_id: yemen.id,
      create_date: timestamp(),
      write_date: timestamp(),
    },
  });
  seedGovernorateId = ibb.id;

  await prisma.districts.createMany({
    data: [
      { name_en: 'Al Qafr', name_ar: 'القفر', governorate_id: ibb.id, create_date: timestamp(), write_date: timestamp() },
      { name_en: 'Yarim', name_ar: 'يريم', governorate_id: ibb.id, create_date: timestamp(), write_date: timestamp() },
      { name_en: 'Ahwar', name_ar: 'أحور', governorate_id: abyan.id, create_date: timestamp(), write_date: timestamp() },
    ],
  });

  for (const list of REFERENCE_SEED) {
    const createdList = await prisma.reference_lists.create({
      data: {
        key: list.key,
        name_ar: list.nameAr,
        is_system: true,
        organization_id: null,
        create_date: timestamp(),
        write_date: timestamp(),
      },
    });

    await prisma.reference_list_items.createMany({
      data: list.items.map((item, index) => ({
        reference_list_id: createdList.id,
        code: item.code,
        label_ar: item.labelAr,
        sort_order: index + 1,
        is_active: true,
        is_default: !!item.isDefault,
        create_date: timestamp(),
        write_date: timestamp(),
      })),
    });
  }

  const adminRole = await prisma.roles.create({
    data: { code: 'admin', name_ar: 'مدير النظام', is_system: true, organization_id: null, create_date: timestamp(), write_date: timestamp() },
  });
  const staffRole = await prisma.roles.create({
    data: { code: 'staff', name_ar: 'موظف', is_system: true, organization_id: null, create_date: timestamp(), write_date: timestamp() },
  });

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
  await prisma.permissions.createMany({
    data: permissionCodes.map((code) => ({
      code,
      module: code.split('.')[0],
      create_date: timestamp(),
      write_date: timestamp(),
    })),
  });
  const permissions = await prisma.permissions.findMany({ where: { code: { in: permissionCodes } } });
  await prisma.role_permissions.createMany({
    data: permissions.map((permission) => ({ role_id: adminRole.id, permission_id: permission.id, created_at: timestamp() })),
  });
  await prisma.role_permissions.create({
    data: {
      role_id: staffRole.id,
      permission_id: permissions.find((permission) => permission.code === 'complaints.view_own').id,
      created_at: timestamp(),
    },
  });

  global.__rbacRoles = { adminRole, staffRole };

  const systemGroup = await prisma.groups.create({
    data: {
      code: 'complaint_officers',
      name_ar: 'موظفو معالجة الشكاوى',
      is_system: true,
      organization_id: null,
      create_date: timestamp(),
      write_date: timestamp(),
    },
  });
  await prisma.group_roles.create({
    data: { group_id: systemGroup.id, role_id: staffRole.id, created_at: timestamp() },
  });

  global.__defaultOrg = await prisma.organizations.create({
    data: {
      legal_name: 'مؤسسة الاختبار',
      short_name: 'Test Org',
      slug: 'test-org',
      country: 'Yemen',
      governorate_id: ibb.id,
      default_language: 'ar',
      timezone: 'Asia/Aden',
      date_format: 'DD/MM/YYYY',
      anonymous_complaints_policy: 'allowed',
      notification_settings: {},
      create_date: timestamp(),
      write_date: timestamp(),
    },
  });

  const workflow = await prisma.workflow_definitions.create({
    data: {
      code: 'complaint_default',
      name_ar: 'سير عمل الشكاوى الافتراضي',
      name_en: 'Default Complaint Workflow',
      entity_type: 'complaint',
      organization_id: null,
      is_active: true,
      create_date: timestamp(),
      write_date: timestamp(),
    },
  });
  const workflowStates = {};
  for (const [code, nameAr, nameEn, isInitial, isFinal, sortOrder] of [
    ['new', 'جديد', 'New', true, false, 1],
    ['in_review', 'قيد المراجعة', 'In Review', false, false, 2],
    ['resolved', 'تم الحل', 'Resolved', false, false, 3],
    ['closed', 'مغلقة', 'Closed', false, true, 4],
    ['rejected', 'مرفوضة', 'Rejected', false, true, 5],
  ]) {
    workflowStates[code] = await prisma.workflow_states.create({
      data: {
        workflow_definition_id: workflow.id,
        code,
        name_ar: nameAr,
        name_en: nameEn,
        is_initial: isInitial,
        is_final: isFinal,
        sort_order: sortOrder,
        create_date: timestamp(),
        write_date: timestamp(),
      },
    });
  }
  for (const [code, from, to] of [
    ['start_review', 'new', 'in_review'],
    ['resolve', 'in_review', 'resolved'],
    ['close', 'resolved', 'closed'],
    ['reject_new', 'new', 'rejected'],
    ['reject_in_review', 'in_review', 'rejected'],
  ]) {
    await prisma.workflow_transitions.create({
      data: {
        workflow_definition_id: workflow.id,
        from_state_id: workflowStates[from].id,
        to_state_id: workflowStates[to].id,
        code,
        name_ar: code,
        name_en: code,
        requires_permission: null,
        create_date: timestamp(),
        write_date: timestamp(),
      },
    });
  }
});

const createOrganization = async (overrides = {}) => prisma.organizations.create({
  data: {
    legal_name: overrides.legalName || `مؤسسة ${Date.now()}`,
    short_name: overrides.shortName || 'Org',
    slug: overrides.slug || `org-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    country: 'Yemen',
    governorate_id: seedGovernorateId,
    default_language: 'ar',
    timezone: 'Asia/Aden',
    date_format: 'DD/MM/YYYY',
    anonymous_complaints_policy: 'allowed',
    notification_settings: {},
    create_date: timestamp(),
    write_date: timestamp(),
  },
});

const createUserWithRole = async (
  { fullName, email, roleCode = 'staff', organizationId = null },
  rawPassword = 'Password123'
) => {
  const targetOrgId = organizationId || global.__defaultOrg.id;
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const user = await prisma.users.create({
    data: {
      full_name: fullName,
      email,
      password_hash: passwordHash,
      default_organization_id: targetOrgId,
      create_date: timestamp(),
      write_date: timestamp(),
    },
  });
  const role = roleCode === 'admin' ? global.__rbacRoles.adminRole : global.__rbacRoles.staffRole;

  await prisma.user_organizations.create({
    data: { user_id: user.id, organization_id: targetOrgId, is_primary: true, is_active: true, create_date: timestamp(), write_date: timestamp() },
  });
  await prisma.user_roles.create({
    data: { user_id: user.id, role_id: role.id, organization_id: targetOrgId, create_date: timestamp(), write_date: timestamp() },
  });

  return { user, rawPassword, organizationId: targetOrgId };
};

afterAll(async () => {
  await closeTestDatabase();
});

module.exports = {
  prisma,
  createUserWithRole,
  createOrganization,
  getDefaultOrg: () => global.__defaultOrg,
  getSeedGovernorateId: () => seedGovernorateId,
  getSeedCountryId: () => seedCountryId,
};
