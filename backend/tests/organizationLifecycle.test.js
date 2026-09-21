'use strict';

const { createOrganization, createUserWithRole, prisma } = require('./setup');

const request = require('supertest');
const app = require('../src/app');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

describe('Organization (Tenant) creation lifecycle and Root Unit integrity', () => {
  let adminToken;
  let adminUserId;
  let staffToken;
  let createdOrgId;
  let rootUnitId;
  let branchTypeId;
  let departmentTypeId;
  let branchNodeId;

  beforeAll(async () => {
    const hostOrg = await createOrganization({ legalName: 'مؤسسة مضيفة لدورة الإنشاء', slug: `lifecycle-host-${unique()}` });
    createdOrgId = hostOrg.id;
    rootUnitId = hostOrg.id;
    const branchType = await prisma.org_unit_types.create({
      data: {
        organization_id: hostOrg.id,
        code: 'branch_sector',
        name_ar: 'فرع / قطاع',
        name_en: 'Branch / Sector',
        hierarchy_level: 1,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    const departmentType = await prisma.org_unit_types.create({
      data: {
        organization_id: hostOrg.id,
        code: 'department',
        name_ar: 'قسم',
        name_en: 'Department',
        hierarchy_level: 2,
        allowed_parent_type_id: branchType.id,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    branchTypeId = branchType.id;
    departmentTypeId = departmentType.id;
    const { user: admin } = await createUserWithRole(
      { fullName: 'مدير المنصة', email: `lifecycle-admin-${unique()}@cfms.local`, roleCode: 'admin', organizationId: hostOrg.id },
      'Password123'
    );
    const { user: staff } = await createUserWithRole(
      { fullName: 'موظف بلا صلاحية', email: `lifecycle-staff-${unique()}@cfms.local`, roleCode: 'staff', organizationId: hostOrg.id },
      'Password123'
    );
    adminUserId = admin.id;

    const [adminRes, staffRes] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: admin.email, password: 'Password123' }),
      request(app).post('/api/auth/login').send({ email: staff.email, password: 'Password123' }),
    ]);
    adminToken = adminRes.body.data.token;
    staffToken = staffRes.body.data.token;
  });

  const createOrgPayload = (overrides = {}) => ({
    legalName: `مؤسسة دورة الإنشاء ${unique()}`,
    slug: `lifecycle-${unique()}`,
    shortName: 'LC Org',
    ...overrides,
  });

  it('يرفض إنشاء مؤسسة بدون توكن (401)', async () => {
    const res = await request(app).post('/api/organization').send(createOrgPayload());
    expect(res.status).toBe(401);
  });

  it('لا يملك مدير المستأجر مسار إنشاء مستأجر جديد (404)', async () => {
    const res = await request(app)
      .post('/api/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(createOrgPayload());
    expect(res.status).toBe(404);
  });

  it('لا يملك المستخدم العادي مسار إنشاء مستأجر جديد (404)', async () => {
    const res = await request(app)
      .post('/api/organization')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(createOrgPayload());
    expect(res.status).toBe(404);
  });

  it('لا يمكن إنشاء وحدة جذرية ثانية: العقدة الجديدة تلحق بالمؤسسة الجذرية', async () => {
    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ name: 'الفرع الرئيسي', orgUnitTypeId: branchTypeId });

    expect(res.status).toBe(201);
    branchNodeId = res.body.data.id;
    expect(res.body.data.parentId).toBe(rootUnitId);
    expect(res.body.data.rootOrganizationId).toBe(rootUnitId);

    // Clearing the parent re-attaches the node beneath the Root Unit instead
    // of detaching it into a second Root Unit (Rules A/B/D).
    const detachRes = await request(app)
      .put(`/api/organization/nodes/${branchNodeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ parentId: null });

    expect(detachRes.status).toBe(200);
    expect(detachRes.body.data.parentId).toBe(rootUnitId);

    const secondRootCount = await prisma.organizations.count({
      where: { root_organization_id: rootUnitId, parent_id: null },
    });
    expect(secondRootCount).toBe(0);
  });

  it('يرفض تحريك الوحدة الجذرية أو تعيين نوع وحدة لها (Rules B/E)', async () => {
    const moveRes = await request(app)
      .put(`/api/organization/nodes/${rootUnitId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ parentId: branchNodeId });
    expect(moveRes.status).toBe(400);

    const typeRes = await request(app)
      .put(`/api/organization/nodes/${rootUnitId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ orgUnitTypeId: branchTypeId });
    expect(typeRes.status).toBe(400);
  });

  it('يفرض تسلسل الأنواع عند توفر allowed_parent_type_id', async () => {
    // department requires a branch_sector parent: under the Root Unit it is rejected
    const underRootRes = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ name: 'قسم بلا فرع', orgUnitTypeId: departmentTypeId });
    expect(underRootRes.status).toBe(422);

    // under the branch node it succeeds
    const underBranchRes = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ name: 'قسم المالية', orgUnitTypeId: departmentTypeId, parentId: branchNodeId });
    expect(underBranchRes.status).toBe(201);
    expect(underBranchRes.body.data.parentId).toBe(branchNodeId);
  });

  it('يحجز الرمز organization لأنواع الوحدات التابعة (Rule H)', async () => {
    const res = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ code: 'organization', nameAr: 'مؤسسة' });
    expect(res.status).toBe(422);
    expect(res.body.message).toContain('محجوز');

    // case-insensitive, also rejected in the host organization context
    const reservedRes = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'Organization', nameAr: 'مؤسسة بحرف كبير' });
    expect(reservedRes.status).toBe(422);
  });

  it('يحافظ على مرونة الهيكل عندما لا يعلن النوع عن أصل محدد', async () => {
    const typeRes = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ code: `team_${Date.now()}`, nameAr: 'فريق', hierarchyLevel: 3 });
    expect(typeRes.status).toBe(201);

    const nestedRes = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', String(createdOrgId))
      .send({ name: 'فريق مرن', orgUnitTypeId: typeRes.body.data.id, parentId: branchNodeId });
    expect(nestedRes.status).toBe(201);
  });
});
