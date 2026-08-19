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
  });

  it('يرفض تحديث الألوان بصيغة hex غير صالحة', async () => {
    const res = await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryColor: 'not-a-color' });
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

  it('ينشئ وحدة من نوع فرع مباشرة تحت المؤسسة', async () => {
    const res = await request(app)
      .post('/api/org-structure/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: branchTypeId, name: 'فرع صنعاء' });

    expect(res.status).toBe(201);
  });

  it('يرفض إنشاء وحدة قسم بدون تحديد وحدة أم من النوع المسموح', async () => {
    const res = await request(app)
      .post('/api/org-structure/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: departmentTypeId, name: 'قسم الشكاوى' });

    expect(res.status).toBe(422);
  });

  it('ينشئ وحدة قسم بنجاح عندما تكون تابعة لفرع', async () => {
    const branchRes = await request(app)
      .post('/api/org-structure/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: branchTypeId, name: 'فرع عدن' });
    const branchUnitId = branchRes.body.data.id;

    const res = await request(app)
      .post('/api/org-structure/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: departmentTypeId, name: 'قسم الشكاوى', parentId: branchUnitId });

    expect(res.status).toBe(201);
    expect(res.body.data.parentId).toBe(branchUnitId);
  });
});
