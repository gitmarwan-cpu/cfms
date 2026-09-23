'use strict';

const { createOrganization, createUserWithRole } = require('./setup');
const request = require('supertest');
const { default: app } = require('../src/app');
const { default: prisma } = require('../src/prisma/client');

describe('Auth API', () => {
  beforeAll(async () => {
    await createUserWithRole(
      { fullName: 'مستخدم تجريبي', email: 'test.admin@cfms.local', roleCode: 'admin' },
      'Password123'
    );
  });

  it('يسجل الدخول بنجاح ببيانات صحيحة ويرجع توكن JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test.admin@cfms.local', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe('test.admin@cfms.local');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    const audit = await prisma.audit_logs.findFirst({
      where: { actor_user_id: res.body.data.user.id, action: 'auth.login.succeeded' },
      orderBy: { created_at: 'desc' },
    });
    expect(audit).toMatchObject({ entity_type: 'user', entity_id: res.body.data.user.id });
  });

  it('يرفض تسجيل الدخول بكلمة مرور خاطئة', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test.admin@cfms.local', password: 'WrongPass1' });

    expect(res.status).toBe(401);
  });

  it('/api/auth/me يتطلب توكن صالح', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('/api/auth/me يرجع عضويات المؤسسات النشطة فقط مع أسمائها (منظم سياق المؤسسة)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test.admin@cfms.local', password: 'Password123' });
    expect(login.status).toBe(200);
    const token = login.body.data.token;
    const userId = login.body.data.user.id;

    const first = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(Array.isArray(first.body.data.organizations)).toBe(true);
    expect(first.body.data.organizations).toHaveLength(1);
    expect(first.body.data.organizations[0]).toMatchObject({ isPrimary: true });
    expect(typeof first.body.data.organizations[0].name).toBe('string');
    const baseOrgId = first.body.data.organizations[0].id;

    // عضوية ثانية نشطة → تظهر في القائمة (قابلة للتبديل)
    const secondOrg = await createOrganization({ legalName: 'مؤسسة عضوية ثانية', slug: `me-second-${Date.now()}` });
    await prisma.user_organizations.create({
      data: { user_id: userId, organization_id: secondOrg.id, is_active: true, create_date: new Date(), write_date: new Date() },
    });
    const second = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.data.organizations).toHaveLength(2);
    expect(second.body.data.organizations.map((org) => org.id)).toContain(secondOrg.id);

    // تعطيل العضوية → تختفي (لا يمكن اختيار مؤسسة غير مصرّح بها)
    await prisma.user_organizations.updateMany({
      where: { user_id: userId, organization_id: secondOrg.id },
      data: { is_active: false },
    });
    const third = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(third.status).toBe(200);
    expect(third.body.data.organizations).toHaveLength(1);
    expect(third.body.data.organizations[0].id).toBe(baseOrgId);
  });

  it('permits login and JWT generation for users of a suspended tenant, but excludes suspended tenant from getMyOrganizations and blocks operational tenant API access', async () => {
    const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const suspendedOrg = await createOrganization({
      legalName: 'مؤسسة معلقة للاختبار',
      slug: `suspended-auth-${unique}`,
    });

    const suspendedUser = await createUserWithRole(
      {
        fullName: 'مستخدم مؤسسة معلقة',
        email: `suspended.user-${unique}@cfms.local`,
        roleCode: 'admin',
        organizationId: suspendedOrg.id,
      },
      'Password123'
    );

    await prisma.organizations.update({
      where: { id: suspendedOrg.id },
      data: { lifecycle_status: 'suspended', is_active: false },
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: suspendedUser.user.email, password: 'Password123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty('token');
    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    const orgIds = meRes.body.data.organizations.map((org) => org.id);
    expect(orgIds).not.toContain(suspendedOrg.id);

    const operationalRes = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${token}`)
      .set('x-organization-id', String(suspendedOrg.id));

    expect(operationalRes.status).toBe(403);
  });
});
