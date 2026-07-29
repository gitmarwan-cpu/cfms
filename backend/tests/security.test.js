'use strict';

const { createUserWithRole, createOrganization } = require('./setup');
const request = require('supertest');
const app = require('../src/app');

describe('Security fixes verification', () => {
  let orgA;
  let orgB;
  let adminAToken;
  let orgBSystemRoleId;
  let orgBCustomRoleId;
  let orgBBranchTypeId;

  beforeAll(async () => {
    orgA = await createOrganization({ legalName: 'مؤسسة أمن أ', slug: 'security-org-a' });
    orgB = await createOrganization({ legalName: 'مؤسسة أمن ب', slug: 'security-org-b' });

    const { user: adminA } = await createUserWithRole(
      { fullName: 'مدير أمن أ', email: 'sec.admin.a@cfms.local', roleCode: 'admin', organizationId: orgA.id },
      'Password123'
    );
    const { user: adminB } = await createUserWithRole(
      { fullName: 'مدير أمن ب', email: 'sec.admin.b@cfms.local', roleCode: 'admin', organizationId: orgB.id },
      'Password123'
    );

    const loginA = await request(app).post('/api/auth/login').send({ email: adminA.email, password: 'Password123' });
    adminAToken = loginA.body.data.token;

    const loginB = await request(app).post('/api/auth/login').send({ email: adminB.email, password: 'Password123' });
    const adminBToken = loginB.body.data.token;

    // دور مخصّص تنشئه مؤسسة "ب" فقط
    const createRoleRes = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ code: 'org_b_reviewer', nameAr: 'مراجع خاص بمؤسسة ب' });
    orgBCustomRoleId = createRoleRes.body.data.id;

    const rolesRes = await request(app).get('/api/roles').set('Authorization', `Bearer ${adminBToken}`);
    orgBSystemRoleId = rolesRes.body.data.find((r) => r.code === 'admin').id;

    // نوع وحدة تنظيمية تنشئه مؤسسة "ب" فقط
    const branchTypeRes = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ code: 'org_b_branch', nameAr: 'فرع مؤسسة ب', hierarchyLevel: 1 });
    orgBBranchTypeId = branchTypeRes.body.data.id;
  });

  it('يُرجع Rate-Limit headers على مسار تسجيل الدخول', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nonexistent@cfms.local', password: 'x' });
    expect(res.headers).toHaveProperty('ratelimit-limit');
  });

  it('تحديث دور مخصّص من مؤسسة أخرى يُرجع 404 (وليس 403) لإخفاء وجوده', async () => {
    const res = await request(app)
      .put(`/api/roles/${orgBCustomRoleId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ nameAr: 'محاولة تعديل' });

    expect(res.status).toBe(404);
  });

  it('تحديث دور نظامي (admin) يُرجع 403 (موجود فعلاً لكن ممنوع)', async () => {
    const res = await request(app)
      .put(`/api/roles/${orgBSystemRoleId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ nameAr: 'محاولة تعديل دور نظامي' });

    expect(res.status).toBe(403);
  });

  it('يرفض تعيين managerUserId لمستخدم لا ينتمي لنفس المؤسسة', async () => {
    const { user: staffA } = await createUserWithRole(
      { fullName: 'موظف أ', email: 'staff.sec.a@cfms.local', roleCode: 'staff', organizationId: orgA.id },
      'Password123'
    );

    const branchTypeRes = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ code: 'branch_a', nameAr: 'فرع أ', hierarchyLevel: 1 });

    const res = await request(app)
      .post('/api/org-structure/units')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ orgUnitTypeId: branchTypeRes.body.data.id, name: 'فرع تجريبي', managerUserId: staffA.id + 99999 });

    expect(res.status).toBe(422);
  });

  it('يرفض ربط allowedParentTypeId بنوع وحدة من مؤسسة أخرى عند التحديث', async () => {
    const ownTypeRes = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ code: 'dept_a', nameAr: 'قسم أ', hierarchyLevel: 2 });

    const res = await request(app)
      .put(`/api/org-structure/unit-types/${ownTypeRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ allowedParentTypeId: orgBBranchTypeId });

    expect(res.status).toBe(422);
  });
});
