import { PrismaClient, Prisma } from '@prisma/client';
import { parseTestDatabaseUrl } from '../src/config/testDatabaseUrl';
import bcrypt from 'bcryptjs';

const fail = (message: string): never => {
  throw new Error(`[Bootstrap] ${message}`);
};

const verifyDatabaseIdentity = async (prisma: PrismaClient, expectedDatabase: string): Promise<void> => {
  const rows = await prisma.$queryRaw<Array<{ database_name: string; database_schema: string }>>(
    Prisma.sql`SELECT current_database() AS database_name, current_schema() AS database_schema`
  );
  const identity = rows[0];
  if (!identity) fail('Could not resolve PostgreSQL database identity');
  if (identity.database_name !== expectedDatabase) {
    fail(`Connected database '${identity.database_name}' does not match URL database '${expectedDatabase}'`);
  }
  if (identity.database_name === 'cfms_db') fail('Refusing to run against cfms_db');
  if (identity.database_name !== 'cfms_test') fail('This bootstrap script is strictly restricted to the cfms_test database');
  console.log(`[Bootstrap] Verified database identity: ${identity.database_name}`);
};

const ensureReferenceList = async (prisma: PrismaClient, key: string, nameAr: string, nameEn: string, items: { code: string, labelAr: string, labelEn: string }[]) => {
  const now = new Date();
  let list = await prisma.reference_lists.findFirst({ where: { key, organization_id: null } });
  if (!list) {
    list = await prisma.reference_lists.create({ data: { key, name_ar: nameAr, name_en: nameEn, is_system: true, organization_id: null, create_date: now, write_date: now } });
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item) {
      const existing = await prisma.reference_list_items.findFirst({ where: { reference_list_id: list.id, code: item.code } });
      if (!existing) {
        await prisma.reference_list_items.create({
          data: { reference_list_id: list.id, code: item.code, label_ar: item.labelAr, label_en: item.labelEn, sort_order: i + 1, is_active: true, is_default: i === 0, create_date: now, write_date: now }
        });
      }
    }
  }
};

const main = async (): Promise<void> => {
  const { url, databaseName } = parseTestDatabaseUrl();
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$connect();
    await verifyDatabaseIdentity(prisma, databaseName);

    console.log('[Bootstrap] Starting idempotent data seed...');
    const now = new Date();
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Reference Data
    await ensureReferenceList(prisma, 'gender', 'الجنس', 'Gender', [{ code: 'male', labelAr: 'ذكر', labelEn: 'Male' }, { code: 'female', labelAr: 'أنثى', labelEn: 'Female' }]);
    await ensureReferenceList(prisma, 'age_group', 'الفئة العمرية', 'Age Group', [{ code: '18_30', labelAr: '18 - 30', labelEn: '18 - 30' }]);
    await ensureReferenceList(prisma, 'complaint_category', 'تصنيف الشكوى', 'Category', [{ code: 'service_quality', labelAr: 'جودة الخدمة', labelEn: 'Service Quality' }]);
    await ensureReferenceList(prisma, 'channel', 'قناة الاستلام', 'Channel', [{ code: 'website', labelAr: 'الموقع الإلكتروني', labelEn: 'Website' }]);
    await ensureReferenceList(prisma, 'complaint_type', 'نوع الطلب', 'Type', [{ code: 'complaint', labelAr: 'شكوى', labelEn: 'Complaint' }]);
    await ensureReferenceList(prisma, 'priority', 'الأولوية', 'Priority', [{ code: 'normal', labelAr: 'عادية', labelEn: 'Normal' }]);
    await ensureReferenceList(prisma, 'complainant_relationship', 'علاقة مقدم الطلب', 'Relationship', [{ code: 'beneficiary', labelAr: 'مستفيد', labelEn: 'Beneficiary' }]);

    // 2. Geography
    let country = await prisma.countries.findUnique({ where: { iso2: 'YE' } });
    if (!country) {
      country = await prisma.countries.create({ data: { iso2: 'YE', iso3: 'YEM', name_ar: 'اليمن', name_en: 'Yemen', is_active: true, create_date: now, write_date: now } });
    }
    let gov = await prisma.governorates.findFirst({ where: { name_en: 'Sanaa' } });
    if (!gov) {
      gov = await prisma.governorates.create({ data: { country_id: country.id, name_ar: 'صنعاء', name_en: 'Sanaa', is_active: true, create_date: now, write_date: now } });
    }
    let dist = await prisma.districts.findFirst({ where: { name_en: 'Maain' } });
    if (!dist) {
      dist = await prisma.districts.create({ data: { governorate_id: gov.id, name_ar: 'معين', name_en: 'Maain', is_active: true, create_date: now, write_date: now } });
    }

    // 3. Organization
    let org = await prisma.organizations.findFirst({ where: { slug: 'test-org' } });
    const orgData = {
      legal_name: 'Test Organization',
      short_name: 'TestOrg',
      slug: 'test-org',
      description: 'Development test organization',
      country: 'Yemen',
      default_language: 'ar',
      timezone: 'Asia/Aden',
      date_format: 'DD/MM/YYYY',
      primary_color: '#0e5f66',
      is_active: true,
      create_date: now,
      write_date: now,
    };

    if (!org) {
      org = await prisma.organizations.create({ data: orgData });
    } else {
      org = await prisma.organizations.update({ where: { id: org.id }, data: orgData });
    }

    // 4. Roles & Permissions
    const permissions = ['organization.view', 'complaints.view_all', 'complaints.assign', 'complaints.escalate'];
    for (const code of permissions) {
      let p = await prisma.permissions.findUnique({ where: { code } });
      if (!p) p = await prisma.permissions.create({ data: { code, module: 'complaints', description_ar: code, create_date: now, write_date: now } });
    }

    let adminRole = await prisma.roles.findFirst({ where: { code: 'admin', organization_id: null } });
    if (!adminRole) {
      adminRole = await prisma.roles.create({
        data: { code: 'admin', name_ar: 'مدير', name_en: 'Admin', description: 'Admin role', is_system: true, is_active: true, create_date: now, write_date: now }
      });
    }
    const allPerms = await prisma.permissions.findMany();
    for (const p of allPerms) {
      const rp = await prisma.role_permissions.findFirst({ where: { role_id: adminRole.id, permission_id: p.id } });
      if (!rp) {
        await prisma.role_permissions.create({ data: { roles: { connect: { id: adminRole.id } }, permissions: { connect: { id: p.id } }, created_at: now } });
      }
    }

    let staffRole = await prisma.roles.findFirst({ where: { code: 'staff', organization_id: null } });
    if (!staffRole) {
      staffRole = await prisma.roles.create({
        data: { code: 'staff', name_ar: 'موظف', name_en: 'Staff', description: 'Staff role', is_system: true, is_active: true, create_date: now, write_date: now }
      });
    }

    // 5. Org Unit Type & Org Unit
    let orgUnitType = await prisma.org_unit_types.findFirst({ where: { organization_id: org.id, code: 'branch' } });
    if (!orgUnitType) {
      orgUnitType = await prisma.org_unit_types.create({
        data: { organization_id: org.id, code: 'branch', name_ar: 'فرع', name_en: 'Branch', hierarchy_level: 1, is_active: true, create_date: now, write_date: now }
      });
    }

    let subOrgNode = await prisma.organizations.findFirst({ where: { parent_id: org.id, code: 'main-branch' } });
    if (!subOrgNode) {
      subOrgNode = await prisma.organizations.create({
        data: {
          legal_name: 'الفرع الرئيسي',
          code: 'main-branch',
          slug: `main-branch-${org.id}`,
          parent_id: org.id,
          root_organization_id: org.id,
          org_unit_type_id: orgUnitType.id,
          is_active: true,
          create_date: now,
          write_date: now,
        },
      });
    }

    // 6. Users — direct UserRole assignments are the only RBAC bootstrap path.
    let adminUser = await prisma.users.findUnique({ where: { email: 'admin@test.local' } });
    if (!adminUser) {
      adminUser = await prisma.users.create({
        data: { full_name: 'Test Admin', email: 'admin@test.local', password_hash: passwordHash, is_active: true, default_organization_id: org.id, create_date: now, write_date: now }
      });
    }
    let adminOrg = await prisma.user_organizations.findFirst({ where: { user_id: adminUser.id, organization_id: org.id } });
    if (!adminOrg) {
      await prisma.user_organizations.create({ data: { users: { connect: { id: adminUser.id } }, organizations: { connect: { id: org.id } }, is_primary: true, is_active: true, create_date: now, write_date: now } });
    }
    let adminUserRole = await prisma.user_roles.findFirst({ where: { user_id: adminUser.id, role_id: adminRole.id, organization_id: org.id } });
    if (!adminUserRole) {
      await prisma.user_roles.create({ data: { users: { connect: { id: adminUser.id } }, roles: { connect: { id: adminRole.id } }, organizations: { connect: { id: org.id } }, create_date: now, write_date: now } });
    }

    let staffUser = await prisma.users.findUnique({ where: { email: 'staff@test.local' } });
    if (!staffUser) {
      staffUser = await prisma.users.create({
        data: { full_name: 'Test Staff', email: 'staff@test.local', password_hash: passwordHash, is_active: true, default_organization_id: org.id, create_date: now, write_date: now }
      });
    }
    let staffOrg = await prisma.user_organizations.findFirst({ where: { user_id: staffUser.id, organization_id: org.id } });
    if (!staffOrg) {
      await prisma.user_organizations.create({ data: { users: { connect: { id: staffUser.id } }, organizations: { connect: { id: org.id } }, is_primary: true, is_active: true, create_date: now, write_date: now } });
    }
    let staffUserRole = await prisma.user_roles.findFirst({ where: { user_id: staffUser.id, role_id: staffRole.id, organization_id: org.id } });
    if (!staffUserRole) {
      await prisma.user_roles.create({ data: { users: { connect: { id: staffUser.id } }, roles: { connect: { id: staffRole.id } }, organizations: { connect: { id: org.id } }, create_date: now, write_date: now } });
    }
    // 7. SLA Rule
    let slaRule = await prisma.sla_rules.findFirst({ where: { organization_id: org.id } });
    if (!slaRule) {
      slaRule = await prisma.sla_rules.create({
        data: { organization_id: org.id, name: '72h Rule', first_response_hours: 24, resolution_hours: 72, escalation_interval_hours: 24, is_active: true, create_date: now, write_date: now }
      });
    }

    // 9. Workflow
    let workflow = await prisma.workflow_definitions.findFirst({ where: { entity_type: 'complaint' } });
    if (!workflow) {
      workflow = await prisma.workflow_definitions.create({
        data: { code: 'test_workflow', name_ar: 'مسار تجريبي', name_en: 'Test Workflow', entity_type: 'complaint', is_active: true, create_date: now, write_date: now }
      });
      await prisma.workflow_states.createMany({
        data: [
          { workflow_definition_id: workflow.id, code: 'new', name_ar: 'جديدة', name_en: 'New', is_initial: true, is_final: false, sort_order: 1, create_date: now, write_date: now },
          { workflow_definition_id: workflow.id, code: 'in_review', name_ar: 'قيد المراجعة', name_en: 'In Review', is_initial: false, is_final: false, sort_order: 2, create_date: now, write_date: now },
        ]
      });
    }

    // 10. Complaints
    const categoryItem = await prisma.reference_list_items.findFirst({ where: { code: 'service_quality' } });
    const channelItem = await prisma.reference_list_items.findFirst({ where: { code: 'website' } });
    const priorityItem = await prisma.reference_list_items.findFirst({ where: { code: 'normal' } });
    const relationshipItem = await prisma.reference_list_items.findFirst({ where: { code: 'beneficiary' } });
    const genderItem = await prisma.reference_list_items.findFirst({ where: { code: 'male' } });

    if (!categoryItem || !channelItem || !priorityItem || !relationshipItem || !genderItem) {
      fail('Missing required reference list items for complaints.');
    }

    let complainant1 = await prisma.complainants.findFirst({ where: { phone: '777000111' } });
    if (!complainant1) {
      complainant1 = await prisma.complainants.create({
        data: {
          organization_id: org.id,
          full_name: 'Citizen 1',
          phone: '777000111',
          relationship_item_id: relationshipItem.id,
          gender_item_id: genderItem.id,
          create_date: now,
          write_date: now,
        }
      });
    }

    let complaint1 = await prisma.complaints.findFirst({ where: { reference_code: 'TEST-1001' } });
    if (!complaint1) {
      complaint1 = await prisma.complaints.create({
        data: {
          organization_id: org.id,
          type: 'complaint',
          reference_code: 'TEST-1001',
          description: 'This is a test complaint assigned to a staff user.',
          status: 'new',
          sla_rule_id: slaRule.id,
          sla_due_at: new Date(now.getTime() + 72 * 60 * 60 * 1000),
          assigned_to_user_id: staffUser.id,
          governorate_id: gov.id,
          district_id: dist.id,
          complainant_id: complainant1.id,
          category_item_id: categoryItem.id,
          channel_item_id: channelItem.id,
          priority_item_id: priorityItem.id,
          create_date: now,
          write_date: now,
        }
      });
    }

    let complainant2 = await prisma.complainants.findFirst({ where: { phone: '777000222' } });
    if (!complainant2) {
      complainant2 = await prisma.complainants.create({
        data: {
          organization_id: org.id,
          full_name: 'Citizen 2',
          phone: '777000222',
          relationship_item_id: relationshipItem.id,
          gender_item_id: genderItem.id,
          create_date: now,
          write_date: now,
        }
      });
    }

    let complaint2 = await prisma.complaints.findFirst({ where: { reference_code: 'TEST-1002' } });
    if (!complaint2) {
      complaint2 = await prisma.complaints.create({
        data: {
          organization_id: org.id,
          type: 'complaint',
          reference_code: 'TEST-1002',
          description: 'This is a test complaint assigned to a team/org unit.',
          status: 'in_review',
          sla_rule_id: slaRule.id,
          sla_due_at: new Date(now.getTime() + 72 * 60 * 60 * 1000),
          assigned_to_organization_id: subOrgNode.id,
          governorate_id: gov.id,
          district_id: dist.id,
          complainant_id: complainant2.id,
          category_item_id: categoryItem.id,
          channel_item_id: channelItem.id,
          priority_item_id: priorityItem.id,
          create_date: now,
          write_date: now,
        }
      });
    }

    // 11. Notifications
    let notification = await prisma.notifications.findFirst({ where: { user_id: adminUser.id, organization_id: org.id } });
    if (!notification) {
      notification = await prisma.notifications.create({
        data: {
          user_id: adminUser.id,
          organization_id: org.id,
          notification_type: 'system',
          title: 'System Bootstrapped',
          message: 'Test data has been successfully loaded into cfms_test',
          created_at: now,
        }
      });
    }

    console.log('[Bootstrap] Data seeded successfully.');
    console.log('');
    console.log('=== TEST CREDENTIALS ===');
    console.log('Admin User: admin@test.local / password123');
    console.log('Staff User: staff@test.local / password123');
    console.log('========================');

  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error('[Bootstrap] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
