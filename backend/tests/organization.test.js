'use strict';

const { createUserWithRole, createOrganization, prisma } = require('./setup');
const request = require('supertest');
const app = require('../src/app');

describe('Organization Settings API', () => {
  let adminToken;
  let organization;

  beforeAll(async () => {
    organization = await createOrganization({ legalName: 'مؤسسة تجريبية للاختبار', slug: 'test-org-settings' });
    await prisma.organizations.update({
      where: { id: organization.id },
      data: { primary_color: '#0e5f66' },
    });

    const { user } = await createUserWithRole(
      { fullName: 'مدير المؤسسة', email: 'org.admin@cfms.local', roleCode: 'admin', organizationId: organization.id },
      'Password123'
    );

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' });
    adminToken = res.body.data.token;
  });

  it('يعيد إعدادات المؤسسة العامة (الهوية البصرية) عبر البوابة العامة بدون مصادقة', async () => {
    const res = await request(app).get(`/api/public/${organization.slug}/organization`);
    expect(res.status).toBe(200);
    expect(res.body.data.legalName).toBe('مؤسسة تجريبية للاختبار');
    expect(res.body.data.primaryColor).toBe('#0e5f66');
  });

  it('يرفض جلب إعدادات المؤسسة الإدارية بدون توكن', async () => {
    const res = await request(app).get('/api/organization');
    expect(res.status).toBe(401);
  });

  it('يسمح للـ admin بتحديث الهوية البصرية والألوان (بلا الحاجة لتمرير أي معرّف مؤسسة)', async () => {
    const res = await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryColor: '#123456', shortName: 'NewShort' });

    expect(res.status).toBe(200);
    expect(res.body.data.primaryColor).toBe('#123456');
    expect(res.body.data.shortName).toBe('NewShort');

    const audit = await prisma.audit_logs.findFirst({
      where: { organization_id: organization.id, action: 'organization.updated', entity_id: organization.id },
      orderBy: { created_at: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('يرفض ربط المؤسسة بمحافظة لا تنتمي إلى الدولة المحددة', async () => {
    const otherCountry = await prisma.countries.create({
      data: {
        iso2: 'ZZ',
        iso3: 'ZZZ',
        name_ar: 'دولة اختبارية',
        name_en: 'Test Country',
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    const ibb = await prisma.governorates.findFirst({ where: { name_en: 'Ibb' } });

    const res = await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ countryId: otherCountry.id, governorateId: ibb.id });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('لا تنتمي');
  });

  it('يرفض تحديث الألوان بصيغة hex غير صالحة', async () => {
    const res = await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryColor: 'not-a-color' });
    expect(res.status).toBe(422);
  });

  it('يرفض معرّف الموقع الجغرافي غير الصالح بدلاً من تحويله إلى قيمة فارغة', async () => {
    const res = await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ countryId: 'not-an-id' });

    expect(res.status).toBe(422);
  });
});

describe('Organizational Structure API (flexible hierarchy)', () => {
  let adminToken;
  let branchTypeId;
  let departmentTypeId;

  beforeAll(async () => {
    const organization = await createOrganization({ legalName: 'مؤسسة الهيكل التنظيمي', slug: 'test-org-structure' });

    const { user } = await createUserWithRole(
      {
        fullName: 'مدير الهيكل',
        email: 'structure.admin@cfms.local',
        roleCode: 'admin',
        organizationId: organization.id,
      },
      'Password123'
    );

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' });
    adminToken = res.body.data.token;
  });

  it('ينشئ نوع وحدة تنظيمية من المستوى الأول (فرع/قطاع)', async () => {
    const res = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'branch_sector', nameAr: 'فرع / قطاع', hierarchyLevel: 1 });

    expect(res.status).toBe(201);
    branchTypeId = res.body.data.id;
  });

  it('ينشئ نوع وحدة تنظيمية من المستوى الثاني (قسم) يشترط أباً من نوع الفرع', async () => {
    const res = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'department', nameAr: 'قسم', hierarchyLevel: 2, allowedParentTypeId: branchTypeId });

    expect(res.status).toBe(201);
    departmentTypeId = res.body.data.id;
  });
});

describe('Organization Hierarchy Nodes API (Unified organizations table)', () => {
  let orgA;
  let orgB;
  let adminTokenA;
  let adminTokenB;
  let unitTypeA;
  let unitTypeB;
  let rootNodeA;
  let childNodeA;
  let grandChildNodeA;
  let alternateCountry;
  let alternateGovernorate;
  let alternateDistrict;

  beforeAll(async () => {
    orgA = await createOrganization({ legalName: 'مؤسسة (أ) للربط الهيكلي', slug: `org-nodes-a-${Date.now()}` });
    orgB = await createOrganization({ legalName: 'مؤسسة (ب) المستقلة', slug: `org-nodes-b-${Date.now()}` });

    const { user: userA } = await createUserWithRole(
      { fullName: 'مدير أ', email: `admin.nodes.a.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: orgA.id },
      'Password123'
    );
    const { user: userB } = await createUserWithRole(
      { fullName: 'مدير ب', email: `admin.nodes.b.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: orgB.id },
      'Password123'
    );

    const resA = await request(app).post('/api/auth/login').send({ email: userA.email, password: 'Password123' });
    adminTokenA = resA.body.data.token;

    const resB = await request(app).post('/api/auth/login').send({ email: userB.email, password: 'Password123' });
    adminTokenB = resB.body.data.token;

    const typeResA = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ code: `type_a_${Date.now()}`, nameAr: 'فرع هرمي', hierarchyLevel: 1 });
    unitTypeA = typeResA.body.data.id;

    const typeResB = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminTokenB}`)
      .send({ code: `type_b_${Date.now()}`, nameAr: 'فرع ب', hierarchyLevel: 1 });
    unitTypeB = typeResB.body.data.id;

    alternateCountry = await prisma.countries.create({
      data: {
        iso2: `Z${String(Date.now()).slice(-1)}`,
        name_ar: 'دولة اختبارية',
        name_en: 'Test Country',
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    alternateGovernorate = await prisma.governorates.create({
      data: {
        name_ar: 'محافظة اختبارية',
        name_en: `Test Governorate ${Date.now()}`,
        country_id: alternateCountry.id,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    alternateDistrict = await prisma.districts.create({
      data: {
        name_ar: 'مديرية اختبارية',
        name_en: `Test District ${Date.now()}`,
        governorate_id: alternateGovernorate.id,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
  });

  it('يرفض إنشاء عقدة بنوع وحدة غير صالح بالنسبة للمؤسسة', async () => {
    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'فرع باطل', orgUnitTypeId: 99999 });

    expect(res.status).toBe(422);
  });

  it('ينشئ عقدة جذرية جديدة تحت المؤسسة بنجاح', async () => {
    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'المقر الرئيسي - صنعاء', orgUnitTypeId: unitTypeA });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('المقر الرئيسي - صنعاء');
    expect(res.body.data.rootOrganizationId).toBe(orgA.id);
    rootNodeA = res.body.data;
  });

  it('ينشئ عقدة بقيم جغرافية مترابطة ويرجع المعرفات الرقمية', async () => {
    const country = await prisma.countries.findFirst({ where: { iso2: 'YE' } });
    const governorate = await prisma.governorates.findFirst({ where: { name_en: 'Ibb' } });
    const district = await prisma.districts.findFirst({ where: { name_en: 'Yarim' } });

    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'وحدة بموقع صحيح', orgUnitTypeId: unitTypeA, countryId: country.id, governorateId: governorate.id, districtId: district.id });

    expect(res.status).toBe(201);
    expect(res.body.data.countryId).toBe(country.id);
    expect(res.body.data.governorateId).toBe(governorate.id);
    expect(res.body.data.districtId).toBe(district.id);
  });

  it('يرفض محافظة لا تنتمي إلى الدولة المحددة', async () => {
    const country = await prisma.countries.findFirst({ where: { iso2: 'YE' } });

    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'موقع غير متسق', orgUnitTypeId: unitTypeA, countryId: country.id, governorateId: alternateGovernorate.id });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('لا تنتمي');
  });

  it('يرفض مديرية لا تنتمي إلى المحافظة المحددة', async () => {
    const country = await prisma.countries.findFirst({ where: { iso2: 'YE' } });
    const governorate = await prisma.governorates.findFirst({ where: { name_en: 'Ibb' } });

    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'مديرية غير متسقة', orgUnitTypeId: unitTypeA, countryId: country.id, governorateId: governorate.id, districtId: alternateDistrict.id });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('لا تنتمي');
  });

  it('ينشئ عقدة فرعية تابعة للفرع الرئيسي بنجاح', async () => {
    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'إدارة الشؤون المالية', orgUnitTypeId: unitTypeA, parentId: rootNodeA.id });

    expect(res.status).toBe(201);
    expect(res.body.data.parentId).toBe(rootNodeA.id);
    childNodeA = res.body.data;
  });

  it('ينشئ عقدة من المستوى الثالث (حفيد)', async () => {
    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'قسم المحاسبة', orgUnitTypeId: unitTypeA, parentId: childNodeA.id });

    expect(res.status).toBe(201);
    expect(res.body.data.parentId).toBe(childNodeA.id);
    grandChildNodeA = res.body.data;
  });

  it('يجلب قائمة جميع العقد الهيكلية الخاصة بالمؤسسة فقط (Tenant Isolation)', async () => {
    const resA = await request(app)
      .get('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(resA.status).toBe(200);
    const nodeIdsA = resA.body.data.map((n) => n.id);
    expect(nodeIdsA).toContain(rootNodeA.id);
    expect(nodeIdsA).toContain(childNodeA.id);
    expect(nodeIdsA).toContain(grandChildNodeA.id);

    const resB = await request(app)
      .get('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenB}`);

    expect(resB.status).toBe(200);
    const nodeIdsB = resB.body.data.map((n) => n.id);
    expect(nodeIdsB).not.toContain(rootNodeA.id);
    expect(nodeIdsB).not.toContain(childNodeA.id);
  });

  it('يرفض تعيين أب ينتمي لمؤسسة أخرى (Reject cross-tenant parent)', async () => {
    const res = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminTokenB}`)
      .send({ name: 'فرع متسلل', orgUnitTypeId: unitTypeB, parentId: rootNodeA.id });

    expect(res.status).toBe(422);
  });

  it('يحمي المؤسسة الجذرية من التعطيل عبر مسار العقد التنظيمية', async () => {
    const deactivateRes = await request(app)
      .patch(`/api/organization/nodes/${orgA.id}/deactivate`)
      .set('Authorization', `Bearer ${adminTokenA}`);
    expect(deactivateRes.status).toBe(400);

    const updateRes = await request(app)
      .put(`/api/organization/nodes/${orgA.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ isActive: false });
    expect(updateRes.status).toBe(400);
  });

  it('يرفض تعيين العقدة كأب لنفسها عند التحديث (Reject self-parent)', async () => {
    const res = await request(app)
      .put(`/api/organization/nodes/${childNodeA.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ parentId: childNodeA.id });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('نفسها');
  });

  it('يرفض تعيين عقدة تابعة كأم للوحدة الحالية لمنع الحلقات (Reject descendant-parent cycle)', async () => {
    const res = await request(app)
      .put(`/api/organization/nodes/${rootNodeA.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ parentId: grandChildNodeA.id });

    expect(res.status).toBe(422);
  });

  it('يحدث بيانات العقدة بنجاح (Update node)', async () => {
    const res = await request(app)
      .put(`/api/organization/nodes/${childNodeA.id}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        name: 'إدارة الشؤون المالية والإدارية',
        code: 'FIN-ADM',
        countryId: (await prisma.countries.findFirst({ where: { iso2: 'YE' } })).id,
        governorateId: (await prisma.governorates.findFirst({ where: { name_en: 'Ibb' } })).id,
        districtId: (await prisma.districts.findFirst({ where: { name_en: 'Yarim' } })).id,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('إدارة الشؤون المالية والإدارية');
    expect(res.body.data.code).toBe('FIN-ADM');
    expect(res.body.data.districtId).not.toBeNull();
  });

  it('يعطل العقدة بنجاح (Deactivate node)', async () => {
    const res = await request(app)
      .patch(`/api/organization/nodes/${grandChildNodeA.id}/deactivate`)
      .set('Authorization', `Bearer ${adminTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.deletedAt).not.toBeNull();
  });
});
