'use strict';

const { createUserWithRole, createOrganization } = require('./setup');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prisma/client');
const notificationService = require('../src/services/notificationService.ts');

describe('Security fixes verification', () => {
  let orgA;
  let orgB;
  let adminAToken;
  let adminAUser;
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
    adminAUser = adminA;
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

  it('يبذر صلاحية audit.view ويربطها بدور المدير النظامي', async () => {
    const permission = await prisma.permissions.findUnique({ where: { code: 'audit.view' } });
    expect(permission).not.toBeNull();

    const mapping = await prisma.role_permissions.findFirst({
      where: {
        role_id: global.__rbacRoles.adminRole.id,
        permission_id: permission.id,
      },
    });
    expect(mapping).not.toBeNull();
  });

  it('يسمح لمدير المؤسسة الحالي بصلاحية audit.view بقراءة سجل التدقيق', async () => {
    const adminResponse = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body).toMatchObject({ success: true, pagination: expect.any(Object) });
  });

  it('يرفض قراءة سجل التدقيق لمستخدم بلا صلاحية audit.view في المؤسسة الحالية', async () => {
    const { user: staffA } = await createUserWithRole(
      { fullName: 'موظف سجل التدقيق', email: 'audit.staff.a@cfms.local', roleCode: 'staff', organizationId: orgA.id },
      'Password123'
    );
    const staffLogin = await request(app).post('/api/auth/login').send({ email: staffA.email, password: 'Password123' });
    const staffResponse = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${staffLogin.body.data.token}`);
    expect(staffResponse.status).toBe(403);
  });

  it('يمنع مدير مؤسسة أ من قراءة سجل تدقيق مؤسسة ب عند انتحال سياقها (لا تسرّب صلاحية admin عبر المؤسسات)', async () => {
    const { user: crossTenantUser } = await createUserWithRole(
      {
        fullName: 'مدير عبر المؤسسات',
        email: 'audit.cross.tenant@cfms.local',
        roleCode: 'admin',
        organizationId: orgA.id,
      },
      'Password123'
    );

    const now = new Date();
    await prisma.user_organizations.create({
      data: {
        user_id: crossTenantUser.id,
        organization_id: orgB.id,
        is_primary: false,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.user_roles.create({
      data: {
        user_id: crossTenantUser.id,
        role_id: global.__rbacRoles.staffRole.id,
        organization_id: orgB.id,
        create_date: now,
        write_date: now,
      },
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: crossTenantUser.email, password: 'Password123' });
    expect(login.status).toBe(200);
    const token = login.body.data.token;

    const deniedInOrgB = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', String(orgB.id));
    expect(deniedInOrgB.status).toBe(403);

    const allowedInOrgA = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', String(orgA.id));
    expect(allowedInOrgA.status).toBe(200);
    expect(allowedInOrgA.body).toMatchObject({ success: true, pagination: expect.any(Object) });
  });

  it('يقصر تقارير الشكاوى على المدير وسياق المؤسسة الحالي', async () => {
    const reportResponse = await request(app)
      .get('/api/reports/complaints')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(reportResponse.status).toBe(200);
    expect(reportResponse.body.data).toMatchObject({ summary: expect.any(Object), byStatus: expect.any(Array) });

    const { user: staffA } = await createUserWithRole(
      { fullName: 'موظف تقارير', email: 'report.staff.a@cfms.local', roleCode: 'staff', organizationId: orgA.id },
      'Password123'
    );
    const staffLogin = await request(app).post('/api/auth/login').send({ email: staffA.email, password: 'Password123' });
    const staffReportResponse = await request(app)
      .get('/api/reports/complaints')
      .set('Authorization', `Bearer ${staffLogin.body.data.token}`);
    expect(staffReportResponse.status).toBe(403);
  });

  it('isolates user notifications and supports marking an organization notification as read', async () => {
    await notificationService.createNotification(prisma, {
      organizationId: orgA.id,
      userId: adminAUser.id,
      notificationType: 'test.notification',
      title: 'Test notification',
      message: 'Notification isolation test',
    });

    const unread = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(unread.status).toBe(200);
    const notification = unread.body.data.find((entry) => entry.type === 'test.notification');
    expect(notification).toBeDefined();

    const marked = await request(app)
      .patch(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(marked.status).toBe(200);

    const afterRead = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(afterRead.body.data.some((entry) => entry.id === notification.id)).toBe(false);
  });
});
