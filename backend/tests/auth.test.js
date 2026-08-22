'use strict';

const { createUserWithRole } = require('./setup');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prisma/client');

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

  it('ينشئ مستخدمًا عبر register ويسجّل حدث user.created في سجل التدقيق', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test.admin@cfms.local', password: 'Password123' });
    const token = login.body.data.token;

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'مستخدم جديد',
        email: `new-user-${Date.now()}@cfms.local`,
        password: 'Password123',
        roleCode: 'staff',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');

    const audit = await prisma.audit_logs.findFirst({
      where: { action: 'user.created', entity_type: 'user', entity_id: res.body.data.id },
    });
    expect(audit).toMatchObject({ organization_id: login.body.data.user.defaultOrganizationId });
    expect(audit.metadata).toMatchObject({ roleCode: 'staff' });
  });

  it('يرفض register لمن لا يملك صلاحية users.manage', async () => {
    const staff = await createUserWithRole({
      fullName: 'Staff Without Manage',
      email: `staff-nomanage-${Date.now()}@cfms.local`,
      roleCode: 'staff',
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: staff.user.email, password: 'Password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({
        fullName: 'مرفوض',
        email: `denied-${Date.now()}@cfms.local`,
        password: 'Password123',
        roleCode: 'staff',
      });

    expect(res.status).toBe(403);
  });
});
