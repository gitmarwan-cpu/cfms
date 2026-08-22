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
});
