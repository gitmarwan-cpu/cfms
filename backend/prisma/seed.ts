import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const bcrypt = require('bcryptjs') as { hash(value: string, rounds: number): Promise<string> };

type Db = PrismaClient | Prisma.TransactionClient;

type GeographyFile = {
  governorates: Array<{ name_en: string; name_ar: string }>;
  districts: Array<{ name_en: string; name_ar: string; gov_en: string }>;
};

const SEED_DATABASE_PATTERN = /^cfms_seed_[a-z0-9][a-z0-9_-]*$/i;
const now = new Date();

const fail = (message: string): never => {
  throw new Error(`[Prisma seed] ${message}`);
};

const assertSame = (actual: unknown, expected: unknown, context: string): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`Contradictory existing data for ${context}`);
  }
};

const parseSeedUrl = (): { url: string; databaseName: string } => {
  if (process.env.CFMS_ALLOW_SEED !== 'true') {
    fail('CFMS_ALLOW_SEED=true is required before any seed write');
  }

  const value = process.env.CFMS_SEED_DATABASE_URL?.trim();
  if (!value) return fail('CFMS_SEED_DATABASE_URL is required; DATABASE_URL is never used for seeding');

  const parsed = (() => {
    try {
      return new URL(value);
    } catch {
      return fail('CFMS_SEED_DATABASE_URL must be a valid PostgreSQL URL');
    }
  })();

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    fail('CFMS_SEED_DATABASE_URL must use the PostgreSQL protocol and include a host');
  }
  if (!SEED_DATABASE_PATTERN.test(databaseName)) {
    fail(`Refusing seed database '${databaseName}'. Only cfms_seed_* databases are approved`);
  }

  return { url: value, databaseName };
};

const verifyDatabaseIdentity = async (prisma: PrismaClient, expectedDatabase: string): Promise<void> => {
  const rows = await prisma.$queryRaw<Array<{ database_name: string; database_user: string; database_schema: string }>>(
    Prisma.sql`SELECT current_database() AS database_name, current_user AS database_user, current_schema() AS database_schema`
  );
  const identity = rows[0];
  if (!identity) fail('Could not resolve PostgreSQL database identity');
  if (identity.database_name !== expectedDatabase) {
    fail(`Connected database '${identity.database_name}' does not match URL database '${expectedDatabase}'`);
  }
  if (identity.database_name === 'cfms_db') fail('Refusing to seed cfms_db');
  if (identity.database_schema !== 'public') {
    fail(`Refusing to seed schema '${identity.database_schema}'. Expected public`);
  }
  if (!identity.database_user) fail('Could not resolve PostgreSQL current_user');
  console.log(`[Prisma seed] database=${identity.database_name} user=${identity.database_user} schema=${identity.database_schema}`);
};

const COUNTRIES = [
  ['YE', 'YEM', 'اليمن', 'Yemen'], ['SA', 'SAU', 'السعودية', 'Saudi Arabia'],
  ['JO', 'JOR', 'الأردن', 'Jordan'], ['EG', 'EGY', 'مصر', 'Egypt'],
  ['SY', 'SYR', 'سوريا', 'Syria'], ['IQ', 'IRQ', 'العراق', 'Iraq'],
  ['LB', 'LBN', 'لبنان', 'Lebanon'], ['SO', 'SOM', 'الصومال', 'Somalia'],
  ['SD', 'SDN', 'السودان', 'Sudan'], ['AE', 'ARE', 'الإمارات', 'United Arab Emirates'],
] as const;

const REFERENCE_LISTS = [
  { key: 'gender', name_ar: 'الجنس', name_en: 'Gender', is_system: true, items: [
    { code: 'male', label_ar: 'ذكر', label_en: 'Male', sort_order: 1 },
    { code: 'female', label_ar: 'أنثى', label_en: 'Female', sort_order: 2 },
  ] },
  { key: 'age_group', name_ar: 'الفئة العمرية', name_en: 'Age Group', is_system: true, items: [
    { code: 'under_18', label_ar: 'أقل من 18', label_en: 'Under 18', sort_order: 1 },
    { code: '18_30', label_ar: '18 - 30', label_en: '18 - 30', sort_order: 2 },
    { code: '31_45', label_ar: '31 - 45', label_en: '31 - 45', sort_order: 3 },
    { code: '46_60', label_ar: '46 - 60', label_en: '46 - 60', sort_order: 4 },
    { code: 'above_60', label_ar: 'أكثر من 60', label_en: 'Above 60', sort_order: 5 },
  ] },
  { key: 'complaint_category', name_ar: 'تصنيف الشكوى', name_en: 'Complaint Category', is_system: false, items: [
    { code: 'service_quality', label_ar: 'جودة الخدمة', label_en: 'Service Quality', sort_order: 1 },
    { code: 'staff_behavior', label_ar: 'سلوك موظف', label_en: 'Staff Behavior', sort_order: 2 },
    { code: 'corruption_fraud', label_ar: 'فساد / احتيال', label_en: 'Corruption / Fraud', sort_order: 3 },
    { code: 'distribution_issue', label_ar: 'مشكلة في التوزيع', label_en: 'Distribution Issue', sort_order: 4 },
    { code: 'protection_gbv', label_ar: 'حماية / عنف قائم على النوع الاجتماعي (حساسة)', label_en: 'Protection / GBV (Sensitive)', sort_order: 5, meta: { forcesSensitive: true } },
    { code: 'suggestion', label_ar: 'مقترح تحسين', label_en: 'Improvement Suggestion', sort_order: 6 },
    { code: 'other', label_ar: 'أخرى', label_en: 'Other', sort_order: 7 },
  ] },
  { key: 'channel', name_ar: 'قناة الاستلام', name_en: 'Reception Channel', is_system: false, items: [
    { code: 'website', label_ar: 'الموقع الإلكتروني', label_en: 'Website', sort_order: 1, is_default: true },
    { code: 'in_person', label_ar: 'حضوري', label_en: 'In Person', sort_order: 2 },
    { code: 'hotline', label_ar: 'الخط الساخن', label_en: 'Hotline', sort_order: 3 },
    { code: 'suggestion_box', label_ar: 'صندوق الاقتراحات', label_en: 'Suggestion Box', sort_order: 4 },
    { code: 'email', label_ar: 'البريد الإلكتروني', label_en: 'Email', sort_order: 5 },
    { code: 'field_visit', label_ar: 'زيارة ميدانية', label_en: 'Field Visit', sort_order: 6 },
  ] },
  { key: 'complaint_type', name_ar: 'نوع الطلب', name_en: 'Request Type', is_system: true, items: [
    { code: 'complaint', label_ar: 'شكوى', label_en: 'Complaint', sort_order: 1 },
    { code: 'proposal', label_ar: 'مقترح', label_en: 'Proposal', sort_order: 2 },
  ] },
  { key: 'priority', name_ar: 'الأولوية', name_en: 'Priority', is_system: false, items: [
    { code: 'low', label_ar: 'منخفضة', label_en: 'Low', sort_order: 1, meta: { color: '#5b6b6c' } },
    { code: 'normal', label_ar: 'عادية', label_en: 'Normal', sort_order: 2, is_default: true, meta: { color: '#0e5f66' } },
    { code: 'high', label_ar: 'عالية', label_en: 'High', sort_order: 3, meta: { color: '#c77b3f' } },
    { code: 'urgent', label_ar: 'عاجلة', label_en: 'Urgent', sort_order: 4, meta: { color: '#b3261e' } },
  ] },
] as const;

const RELATIONSHIP_ITEMS = [
  ['beneficiary', 'مستفيد', 'Beneficiary', 1, true], ['community_member', 'فرد من المجتمع', 'Community Member', 2, false],
  ['visitor', 'زائر', 'Visitor', 3, false], ['employee', 'موظف', 'Employee', 4, false],
  ['contractor', 'مقاول', 'Contractor', 5, false], ['service_provider', 'مقدّم خدمة', 'Service Provider', 6, false],
  ['partner', 'شريك', 'Partner', 7, false], ['other', 'أخرى', 'Other', 8, false],
] as const;

const PERMISSIONS = [
  ['organization.view', 'organization', 'عرض إعدادات المؤسسة'], ['organization.manage', 'organization', 'تعديل إعدادات المؤسسة'],
  ['reference_data.view', 'reference_data', 'عرض القوائم المرجعية'], ['reference_data.manage', 'reference_data', 'إدارة القوائم المرجعية'],
  ['org_structure.view', 'org_structure', 'عرض الهيكل التنظيمي'], ['org_structure.manage', 'org_structure', 'إدارة الهيكل التنظيمي'],
  ['users.view', 'users', 'عرض المستخدمين'], ['users.manage', 'users', 'إدارة المستخدمين'],
  ['roles.view', 'users', 'عرض الأدوار والصلاحيات'], ['roles.manage', 'users', 'إدارة الأدوار والصلاحيات'],
  ['complaints.view_own', 'complaints', 'عرض الشكاوى المسندة للمستخدم فقط'], ['complaints.view_all', 'complaints', 'عرض جميع الشكاوى'],
  ['complaints.create', 'complaints', 'تسجيل شكوى نيابة عن مستفيد (حالة حضورية/هاتفية)'], ['complaints.assign', 'complaints', 'إسناد الشكاوى لموظف/قسم/فريق'],
  ['complaints.transfer', 'complaints', 'تحويل الشكوى بين الأقسام/الفروع'], ['complaints.close', 'complaints', 'إغلاق الشكوى'],
  ['complaints.escalate', 'complaints', 'تصعيد الشكوى'],
] as const;
const STAFF_DEFAULT_CODES = ['organization.view', 'reference_data.view', 'org_structure.view', 'complaints.view_own'];

const WORKFLOW_STATES = [
  ['new', 'جديدة', 'New', true, false, 1], ['in_review', 'قيد المراجعة', 'In Review', false, false, 2],
  ['resolved', 'تم الحل', 'Resolved', false, false, 3], ['closed', 'أُغلقت', 'Closed', false, true, 4],
  ['rejected', 'مرفوضة', 'Rejected', false, true, 5],
] as const;
const WORKFLOW_TRANSITIONS = [
  ['start_review', 'بدء المراجعة', 'Start Review', 'new', 'in_review'],
  ['resolve', 'حل الشكوى', 'Resolve', 'in_review', 'resolved'],
  ['close', 'إغلاق الشكوى', 'Close', 'resolved', 'closed'],
  ['reject_new', 'رفض (من جديدة)', 'Reject (from New)', 'new', 'rejected'],
  ['reject_in_review', 'رفض (قيد المراجعة)', 'Reject (from In Review)', 'in_review', 'rejected'],
] as const;

const ensureCountryData = async (db: Db): Promise<void> => {
  for (const [iso2, iso3, name_ar, name_en] of COUNTRIES) {
    const existing = await db.countries.findUnique({ where: { iso2 } });
    if (existing) {
      assertSame({ iso3, name_ar, name_en, is_active: true }, { iso3: existing.iso3, name_ar: existing.name_ar, name_en: existing.name_en, is_active: existing.is_active }, `country ${iso2}`);
      continue;
    }
    const conflictingIso3 = await db.countries.findFirst({ where: { iso3 } });
    if (conflictingIso3) fail(`Country iso3 '${iso3}' is already used by iso2 '${conflictingIso3.iso2}'`);
    await db.countries.create({ data: { iso2, iso3, name_ar, name_en, is_active: true, create_date: now, write_date: now } });
  }
};

const seedGeography = async (db: Db): Promise<void> => {
  const filePath = path.resolve(__dirname, '..', 'data', 'yemen_admin.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GeographyFile;
  if (!Array.isArray(data.governorates) || data.governorates.length !== 22) {
    fail('Yemen geography must contain exactly 22 governorates');
  }
  if (!Array.isArray(data.districts) || data.districts.length !== 335) {
    fail('Yemen geography must contain exactly 335 districts');
  }
  const governorateNames = new Set<string>();
  for (const governorate of data.governorates) {
    if (!governorate || typeof governorate.name_en !== 'string' || !governorate.name_en || typeof governorate.name_ar !== 'string' || !governorate.name_ar) {
      fail('Yemen geography contains a malformed governorate');
    }
    if (governorateNames.has(governorate.name_en)) {
      fail(`Yemen geography contains duplicate governorate '${governorate.name_en}'`);
    }
    governorateNames.add(governorate.name_en);
  }
  const districtKeys = new Set<string>();
  for (const district of data.districts) {
    if (!district || typeof district.name_en !== 'string' || !district.name_en || typeof district.name_ar !== 'string' || !district.name_ar || typeof district.gov_en !== 'string' || !district.gov_en) {
      fail('Yemen geography contains a malformed district');
    }
    if (!governorateNames.has(district.gov_en)) {
      fail(`District '${district.name_en}' references unknown governorate '${district.gov_en}'`);
    }
    const districtKey = `${district.gov_en}\u0000${district.name_en}`;
    if (districtKeys.has(districtKey)) {
      fail(`Yemen geography contains duplicate district '${district.gov_en}/${district.name_en}'`);
    }
    districtKeys.add(districtKey);
  }
  const yemen = await db.countries.findUnique({ where: { iso2: 'YE' } });
  if (!yemen) return fail('Country YE must exist before geography seeding');
  if (yemen.iso3 !== 'YEM' || yemen.name_en !== 'Yemen') {
    fail('Country YE does not resolve to Yemen (YEM)');
  }
  const governorateIds = new Map<string, number>();
  for (const governorate of data.governorates) {
    const existing = await db.governorates.findUnique({ where: { name_en: governorate.name_en } });
    if (existing) {
      assertSame({ name_ar: governorate.name_ar, country_id: yemen.id, is_active: true }, { name_ar: existing.name_ar, country_id: existing.country_id, is_active: existing.is_active }, `governorate ${governorate.name_en}`);
      governorateIds.set(governorate.name_en, existing.id);
    } else {
      const created = await db.governorates.create({ data: { name_en: governorate.name_en, name_ar: governorate.name_ar, country_id: yemen.id, is_active: true, create_date: now, write_date: now } });
      governorateIds.set(governorate.name_en, created.id);
    }
  }
  for (const district of data.districts) {
    const governorateId = governorateIds.get(district.gov_en);
    if (governorateId === undefined) return fail(`District '${district.name_en}' references unknown governorate '${district.gov_en}'`);
    const existing = await db.districts.findFirst({ where: { governorate_id: governorateId, name_en: district.name_en } });
    if (existing) {
      assertSame({ name_ar: district.name_ar, is_active: true }, { name_ar: existing.name_ar, is_active: existing.is_active }, `district ${district.gov_en}/${district.name_en}`);
    } else {
      await db.districts.create({ data: { name_en: district.name_en, name_ar: district.name_ar, governorate_id: governorateId, is_active: true, create_date: now, write_date: now } });
    }
  }
};

const ensureReferenceList = async (db: Db, definition: { key: string; name_ar: string; name_en: string; is_system: boolean; items: readonly { code: string; label_ar: string; label_en: string; sort_order: number; is_default?: boolean; meta?: object }[] }): Promise<number> => {
  let list = await db.reference_lists.findFirst({ where: { key: definition.key, organization_id: null } });
  if (list) {
    assertSame({ name_ar: definition.name_ar, name_en: definition.name_en, is_system: definition.is_system }, { name_ar: list.name_ar, name_en: list.name_en, is_system: list.is_system }, `reference list ${definition.key}`);
  } else {
    list = await db.reference_lists.create({ data: { key: definition.key, name_ar: definition.name_ar, name_en: definition.name_en, is_system: definition.is_system, organization_id: null, create_date: now, write_date: now } });
  }
  for (const item of definition.items) {
    const existing = await db.reference_list_items.findFirst({ where: { reference_list_id: list.id, code: item.code } });
    const expected = { label_ar: item.label_ar, label_en: item.label_en, sort_order: item.sort_order, is_active: true, is_default: item.is_default ?? false, meta: item.meta ?? null };
    if (existing) {
      assertSame(expected, { label_ar: existing.label_ar, label_en: existing.label_en, sort_order: existing.sort_order, is_active: existing.is_active, is_default: existing.is_default, meta: existing.meta }, `reference item ${definition.key}/${item.code}`);
    } else {
      await db.reference_list_items.create({ data: { reference_list_id: list.id, code: item.code, ...expected, meta: item.meta === undefined ? Prisma.JsonNull : item.meta as Prisma.InputJsonValue, create_date: now, write_date: now } });
    }
  }
  return list.id;
};

const seedReferenceData = async (db: Db): Promise<void> => {
  for (const definition of REFERENCE_LISTS) await ensureReferenceList(db, definition);
};

const seedComplainantRelationship = async (db: Db): Promise<void> => {
  await ensureReferenceList(db, {
    key: 'complainant_relationship', name_ar: 'علاقة مقدّم الطلب بالمؤسسة', name_en: 'Complainant Relationship', is_system: false,
    items: RELATIONSHIP_ITEMS.map(([code, label_ar, label_en, sort_order, is_default]) => ({ code, label_ar, label_en, sort_order, is_default })),
  });
};

const ensureSystemRoles = async (db: Db): Promise<void> => {
  const roles = [
    { code: 'admin', name_ar: 'مدير النظام', name_en: 'Administrator', description: 'صلاحيات كاملة على المؤسسة والنظام' },
    { code: 'staff', name_ar: 'موظف', name_en: 'Staff', description: 'صلاحيات أساسية لموظفي المعالجة' },
  ] as const;
  for (const role of roles) {
    const existing = await db.roles.findFirst({ where: { code: role.code, organization_id: null } });
    const expected = { ...role, organization_id: null, is_system: true, is_active: true };
    if (existing) {
      assertSame(expected, {
        code: existing.code,
        name_ar: existing.name_ar,
        name_en: existing.name_en,
        description: existing.description,
        organization_id: existing.organization_id,
        is_system: existing.is_system,
        is_active: existing.is_active,
      }, `system role ${role.code}`);
    } else {
      await db.roles.create({ data: { ...expected, create_date: now, write_date: now } });
    }
  }
};

const verifySystemRoles = async (db: Db): Promise<{ adminId: number; staffId: number }> => {
  const roles = await Promise.all(['admin', 'staff'].map((code) => db.roles.findFirst({ where: { code, organization_id: null } })));
  const adminRole = roles[0];
  const staffRole = roles[1];
  if (!adminRole || !staffRole) return fail('Required global admin/staff roles are missing; run the authoritative RBAC migration first');
  for (const role of [adminRole, staffRole]) assertSame({ is_system: true, is_active: true }, { is_system: role.is_system, is_active: role.is_active }, `system role ${role.code}`);
  return { adminId: adminRole.id, staffId: staffRole.id };
};

const seedPermissions = async (db: Db, roleIds: { adminId: number; staffId: number }): Promise<void> => {
  const permissionIds = new Map<string, number>();
  for (const [code, module, description_ar] of PERMISSIONS) {
    const existing = await db.permissions.findUnique({ where: { code } });
    if (existing) {
      assertSame({ module, description_ar }, { module: existing.module, description_ar: existing.description_ar }, `permission ${code}`);
      permissionIds.set(code, existing.id);
    } else {
      const created = await db.permissions.create({ data: { code, module, description_ar, create_date: now, write_date: now } });
      permissionIds.set(code, created.id);
    }
  }
  const allPermissionIds = await db.permissions.findMany({ select: { id: true } });
  for (const { id: permissionId } of allPermissionIds) {
    const existing = await db.role_permissions.findFirst({ where: { role_id: roleIds.adminId, permission_id: permissionId } });
    if (!existing) await db.role_permissions.create({ data: { role_id: roleIds.adminId, permission_id: permissionId, created_at: now } });
  }
  for (const code of STAFF_DEFAULT_CODES) {
    const permissionId = permissionIds.get(code);
    if (permissionId === undefined) return fail(`Staff default permission '${code}' is not defined`);
    const existing = await db.role_permissions.findFirst({ where: { role_id: roleIds.staffId, permission_id: permissionId } });
    if (!existing) await db.role_permissions.create({ data: { role_id: roleIds.staffId, permission_id: permissionId, created_at: now } });
  }
};

const seedBootstrapOrganization = async (db: Db, adminRoleId: number): Promise<void> => {
  const anyOrganization = await db.organizations.findFirst({ select: { id: true } });
  if (anyOrganization) return;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return fail('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required for first-install bootstrap');
  const passwordHash = await bcrypt.hash(password, 10);
  const organization = await db.organizations.create({ data: {
    legal_name: 'المؤسسة الافتراضية', short_name: 'Default Org', slug: 'default-org',
    description: 'مؤسسة افتراضية تلقائية عند أول تنصيب - يمكن للمدير إعادة تسميتها وتهيئتها', country: 'Yemen',
    default_language: 'ar', timezone: 'Asia/Aden', date_format: 'DD/MM/YYYY', primary_color: '#0e5f66',
    secondary_color: '#0a464b', accent_color: '#c77b3f', anonymous_complaints_policy: 'allowed',
    notification_settings: {}, is_active: true, create_date: now, write_date: now,
  } });
  const existingUser = await db.users.findUnique({ where: { email } });
  if (existingUser) fail(`Bootstrap email '${email}' already belongs to an existing user`);
  const user = await db.users.create({ data: { full_name: 'مدير المنصة', email, password_hash: passwordHash, is_active: true, default_organization_id: organization.id, create_date: now, write_date: now } });
  await db.user_organizations.create({ data: { user_id: user.id, organization_id: organization.id, is_primary: true, is_active: true, create_date: now, write_date: now } });
  await db.user_roles.create({ data: { user_id: user.id, role_id: adminRoleId, organization_id: organization.id, create_date: now, write_date: now } });
};

const seedOrgUnitTypes = async (db: Db): Promise<void> => {
  const organization = await db.organizations.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
  if (!organization) return;
  let branch = await db.org_unit_types.findFirst({ where: { organization_id: organization.id, code: 'branch_sector' } });
  if (!branch) branch = await db.org_unit_types.create({ data: { organization_id: organization.id, code: 'branch_sector', name_ar: 'فرع / قطاع', name_en: 'Branch / Sector', hierarchy_level: 1, allowed_parent_type_id: null, is_active: true, create_date: now, write_date: now } });
  else assertSame({ name_ar: 'فرع / قطاع', name_en: 'Branch / Sector', hierarchy_level: 1, allowed_parent_type_id: null, is_active: true }, { name_ar: branch.name_ar, name_en: branch.name_en, hierarchy_level: branch.hierarchy_level, allowed_parent_type_id: branch.allowed_parent_type_id, is_active: branch.is_active }, 'org unit type branch_sector');
  const department = await db.org_unit_types.findFirst({ where: { organization_id: organization.id, code: 'department' } });
  if (!department) await db.org_unit_types.create({ data: { organization_id: organization.id, code: 'department', name_ar: 'قسم', name_en: 'Department', hierarchy_level: 2, allowed_parent_type_id: branch.id, is_active: true, create_date: now, write_date: now } });
  else assertSame({ name_ar: 'قسم', name_en: 'Department', hierarchy_level: 2, allowed_parent_type_id: branch.id, is_active: true }, { name_ar: department.name_ar, name_en: department.name_en, hierarchy_level: department.hierarchy_level, allowed_parent_type_id: department.allowed_parent_type_id, is_active: department.is_active }, 'org unit type department');
};

const seedWorkflow = async (db: Db): Promise<void> => {
  let definition = await db.workflow_definitions.findFirst({ where: { code: 'complaint_default', organization_id: null } });
  if (definition) assertSame({ name_ar: 'سير عمل الشكاوى الافتراضي', name_en: 'Default Complaint Workflow', entity_type: 'complaint', is_active: true }, { name_ar: definition.name_ar, name_en: definition.name_en, entity_type: definition.entity_type, is_active: definition.is_active }, 'workflow complaint_default');
  else definition = await db.workflow_definitions.create({ data: { code: 'complaint_default', name_ar: 'سير عمل الشكاوى الافتراضي', name_en: 'Default Complaint Workflow', entity_type: 'complaint', is_active: true, organization_id: null, create_date: now, write_date: now } });
  const stateIds = new Map<string, number>();
  for (const [code, name_ar, name_en, is_initial, is_final, sort_order] of WORKFLOW_STATES) {
    const existing = await db.workflow_states.findFirst({ where: { workflow_definition_id: definition.id, code } });
    const state = existing || await db.workflow_states.create({ data: { workflow_definition_id: definition.id, code, name_ar, name_en, is_initial, is_final, sort_order, create_date: now, write_date: now } });
    if (existing) assertSame({ name_ar, name_en, is_initial, is_final, sort_order }, { name_ar: existing.name_ar, name_en: existing.name_en, is_initial: existing.is_initial, is_final: existing.is_final, sort_order: existing.sort_order }, `workflow state ${code}`);
    stateIds.set(code, state.id);
  }
  for (const [code, name_ar, name_en, from, to] of WORKFLOW_TRANSITIONS) {
    const fromStateId = stateIds.get(from);
    const toStateId = stateIds.get(to);
    if (fromStateId === undefined || toStateId === undefined) return fail(`Workflow transition '${code}' references an unknown state`);
    const existing = await db.workflow_transitions.findFirst({ where: { workflow_definition_id: definition.id, code } });
    if (existing) assertSame({ from_state_id: fromStateId, to_state_id: toStateId, name_ar, name_en, requires_permission: null }, { from_state_id: existing.from_state_id, to_state_id: existing.to_state_id, name_ar: existing.name_ar, name_en: existing.name_en, requires_permission: existing.requires_permission }, `workflow transition ${code}`);
    else await db.workflow_transitions.create({ data: { workflow_definition_id: definition.id, from_state_id: fromStateId, to_state_id: toStateId, code, name_ar, name_en, requires_permission: null, create_date: now, write_date: now } });
  }
};

const runSeed = async (db: Db): Promise<void> => {
  await ensureCountryData(db);
  await seedGeography(db);
  await seedReferenceData(db);
  await seedComplainantRelationship(db);
  await ensureSystemRoles(db);
  const roles = await verifySystemRoles(db);
  await seedPermissions(db, roles);
  await seedBootstrapOrganization(db, roles.adminId);
  await seedOrgUnitTypes(db);
  await seedWorkflow(db);
};

const main = async (): Promise<void> => {
  const { url, databaseName } = parseSeedUrl();
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['warn', 'error'] });
  try {
    await prisma.$connect();
    await verifyDatabaseIdentity(prisma, databaseName);
    await prisma.$transaction((tx) => runSeed(tx), { maxWait: 10000, timeout: 120000 });
    console.log('[Prisma seed] completed successfully');
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error('[Prisma seed] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
