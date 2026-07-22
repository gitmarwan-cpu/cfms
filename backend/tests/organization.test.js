'use strict';

require('./setup');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { User, Organization } = require('../src/models');

describe('Organization Settings API', () => {
  let adminToken;
  let organizationId;

  beforeAll(async () => {
    const org = await Organization.create({
      legalName: 'مؤسسة تجريبية للاختبار',
      shortName: 'TestOrg',
      primaryColor: '#0e5f66',
    });
    organizationId = org.id;

    const passwordHash = await bcrypt.hash('Password123', 10);
    const admin = await User.create({
      fullName: 'مدير المؤسسة',
      email: 'org.admin@cfms.local',
      passwordHash,
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'Password123' });
    adminToken = res.body.data.token;
  });

  it('يعيد إعدادات المؤسسة العامة (الهوية البصرية) بدون مصادقة', async () => {
    const res = await request(app).get('/api/organization');
    expect(res.status).toBe(200);
    expect(res.body.data.legalName).toBe('مؤسسة تجريبية للاختبار');
    expect(res.body.data.primaryColor).toBe('#0e5f66');
  });

  it('يرفض تحديث إعدادات المؤسسة بدون صلاحية admin', async () => {
    const res = await request(app)
      .put(`/api/organization/${organizationId}`)
      .send({ primaryColor: '#111111' });
    expect(res.status).toBe(401);
  });

  it('يسمح للـ admin بتحديث الهوية البصرية والألوان', async () => {
    const res = await request(app)
      .put(`/api/organization/${organizationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryColor: '#123456', shortName: 'NewShort' });

    expect(res.status).toBe(200);
    expect(res.body.data.primaryColor).toBe('#123456');
    expect(res.body.data.shortName).toBe('NewShort');
  });

  it('يرفض تحديث الألوان بصيغة hex غير صالحة', async () => {
    const res = await request(app)
      .put(`/api/organization/${organizationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryColor: 'not-a-color' });
    expect(res.status).toBe(422);
  });
});

describe('Organizational Structure API (flexible hierarchy)', () => {
  let adminToken;
  let organizationId;
  let branchTypeId;
  let departmentTypeId;

  beforeAll(async () => {
    const org = await Organization.create({ legalName: 'مؤسسة الهيكل التنظيمي' });
    organizationId = org.id;

    const passwordHash = await bcrypt.hash('Password123', 10);
    const admin = await User.create({
      fullName: 'مدير الهيكل',
      email: 'structure.admin@cfms.local',
      passwordHash,
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'Password123' });
    adminToken = res.body.data.token;
  });

  it('ينشئ نوع وحدة تنظيمية من المستوى الأول (فرع/قطاع)', async () => {
    const res = await request(app)
      .post(`/api/org-structure/${organizationId}/unit-types`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'branch_sector', nameAr: 'فرع / قطاع', hierarchyLevel: 1 });

    expect(res.status).toBe(201);
    branchTypeId = res.body.data.id;
  });

  it('ينشئ نوع وحدة تنظيمية من المستوى الثاني (قسم) يشترط أباً من نوع الفرع', async () => {
    const res = await request(app)
      .post(`/api/org-structure/${organizationId}/unit-types`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'department', nameAr: 'قسم', hierarchyLevel: 2, allowedParentTypeId: branchTypeId });

    expect(res.status).toBe(201);
    departmentTypeId = res.body.data.id;
  });

  it('ينشئ وحدة من نوع فرع مباشرة تحت المؤسسة', async () => {
    const res = await request(app)
      .post(`/api/org-structure/${organizationId}/units`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: branchTypeId, name: 'فرع صنعاء' });

    expect(res.status).toBe(201);
  });

  it('يرفض إنشاء وحدة قسم بدون تحديد وحدة أم من النوع المسموح', async () => {
    const res = await request(app)
      .post(`/api/org-structure/${organizationId}/units`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: departmentTypeId, name: 'قسم الشكاوى' });

    expect(res.status).toBe(422);
  });

  it('ينشئ وحدة قسم بنجاح عندما تكون تابعة لفرع', async () => {
    const branchRes = await request(app)
      .post(`/api/org-structure/${organizationId}/units`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: branchTypeId, name: 'فرع عدن' });
    const branchUnitId = branchRes.body.data.id;

    const res = await request(app)
      .post(`/api/org-structure/${organizationId}/units`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orgUnitTypeId: departmentTypeId, name: 'قسم الشكاوى', parentId: branchUnitId });

    expect(res.status).toBe(201);
    expect(res.body.data.parentId).toBe(branchUnitId);
  });
});
