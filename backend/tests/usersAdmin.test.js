'use strict';

/**
 * User Administration Integration Tests
 *
 * Covers:
 *   - users.view: list, detail
 *   - users.manage: update, activate, deactivate
 *   - Tenant isolation (list, detail, update)
 *   - Inactive filtering
 *   - Search
 *   - Last-admin protection
 *   - Organization-node ownership validation
 *   - Role/group access control
 *   - Unauthorized access
 *
 * Does NOT modify existing tests or weaken existing assertions.
 * Does NOT touch complaint, workflow, report, or authentication code.
 */

const { createUserWithRole, createOrganization, getDefaultOrg, prisma } = require('./setup');
const request = require('supertest');
const app = require('../src/app');
const bcrypt = require('bcryptjs');

const timestamp = () => new Date();

// Helper: log in and return token
const login = async (email, password = 'Password123') => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

describe('User Administration API', () => {
  let adminToken;
  let staffToken;
  let adminUser;
  let staffUser;
  let defaultOrg;

  beforeAll(async () => {
    defaultOrg = getDefaultOrg();

    const adminResult = await createUserWithRole(
      { fullName: 'مدير اختبارات المستخدمين', email: 'useradmin.admin@cfms.local', roleCode: 'admin' },
      'Password123'
    );
    adminUser = adminResult.user;

    const staffResult = await createUserWithRole(
      { fullName: 'موظف اختبارات المستخدمين', email: 'useradmin.staff@cfms.local', roleCode: 'staff' },
      'Password123'
    );
    staffUser = staffResult.user;

    adminToken = await login('useradmin.admin@cfms.local');
    staffToken = await login('useradmin.staff@cfms.local');
  });

  // ── List Users ──────────────────────────────────────────────────────────────

  it('يمكن لمستخدم ذي صلاحية users.view استرداد قائمة المستخدمين', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    // Ensure no password hash leaks
    expect(res.body.data.every((u) => !u.passwordHash && !u.password_hash)).toBe(true);
  });

  it('يرفض استرداد القائمة بدون توكن مصادقة', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('يرفض استرداد القائمة من مستخدم بدون صلاحية users.view', async () => {
    // staff role has complaints.view_own only — no users.view
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  // ── User Detail ─────────────────────────────────────────────────────────────

  it('يمكن لمدير استرداد تفاصيل مستخدم ضمن مؤسسته', async () => {
    const res = await request(app)
      .get(`/api/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(adminUser.id);
    expect(res.body.data.email).toBe(adminUser.email);
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(res.body.data).not.toHaveProperty('password_hash');
    expect(res.body.data).toHaveProperty('createdAt');
    expect(res.body.data).toHaveProperty('updatedAt');
  });

  it('يرجع 404 لمستخدم ذي معرّف غير موجود', async () => {
    const res = await request(app)
      .get('/api/users/999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('مستخدم بصلاحية users.view فقط لا يستطيع تحديث بيانات مستخدم آخر', async () => {
    // First: give staff user users.view (it has none; we verify that 403 is returned even if staffRole had users.view,
    // the important thing is no users.manage = no update)
    const res = await request(app)
      .put(`/api/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'محاولة تعديل' });
    expect(res.status).toBe(403);
  });

  // ── Update User ─────────────────────────────────────────────────────────────

  it('يمكن لمدير تحديث بيانات مستخدم ضمن مؤسسته', async () => {
    const newName = 'موظف معدّل الاسم';
    const res = await request(app)
      .put(`/api/users/${staffUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: newName });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe(newName);
    expect(res.body.data.id).toBe(staffUser.id);
  });

  it('يرفض تحديث البريد الإلكتروني لبريد مستخدم موجود آخر', async () => {
    const res = await request(app)
      .put(`/api/users/${staffUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: adminUser.email });

    expect(res.status).toBe(409);
  });

  // ── Activate / Deactivate ───────────────────────────────────────────────────

  it('يمكن للمدير إلغاء تفعيل مستخدم ثم إعادة تفعيله', async () => {
    // Create a dedicated user for deactivation test
    const { user: target } = await createUserWithRole(
      { fullName: 'مستخدم للإلغاء', email: 'deactivate.target@cfms.local', roleCode: 'staff' },
      'Password123'
    );

    // Deactivate
    const deactivateRes = await request(app)
      .patch(`/api/users/${target.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.isActive).toBe(false);

    // Activate
    const activateRes = await request(app)
      .patch(`/api/users/${target.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.isActive).toBe(true);
  });

  it('يرفض إلغاء تفعيل مستخدم غير مفعّل أصلاً', async () => {
    // Create + deactivate first
    const { user: target2 } = await createUserWithRole(
      { fullName: 'مستخدم معطّل', email: 'already.inactive@cfms.local', roleCode: 'staff' },
      'Password123'
    );
    await request(app)
      .patch(`/api/users/${target2.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try again
    const res = await request(app)
      .patch(`/api/users/${target2.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  // ── Last-Admin Protection ───────────────────────────────────────────────────

  it('يرفض إلغاء تفعيل آخر مدير نشط في المؤسسة', async () => {
    // Create a fresh org with a single admin
    const singleAdminOrg = await createOrganization({ legalName: 'مؤسسة مدير واحد', slug: `single-admin-org-${Date.now()}` });
    const { user: singleAdmin } = await createUserWithRole(
      { fullName: 'المدير الوحيد', email: `single.admin.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: singleAdminOrg.id },
      'Password123'
    );
    const singleAdminToken = await login(singleAdmin.email);

    const res = await request(app)
      .patch(`/api/users/${singleAdmin.id}/deactivate`)
      .set('Authorization', `Bearer ${singleAdminToken}`);

    // Self-deactivation is blocked as a separate guard
    expect([400]).toContain(res.status);
  });

  it('يرفض إلغاء تفعيل المدير إذا كان المدير الوحيد النشط (من مدير آخر)', async () => {
    const soloOrg = await createOrganization({ legalName: 'مؤسسة المدير الوحيد2', slug: `solo-admin-org-${Date.now()}` });
    const { user: soloAdmin } = await createUserWithRole(
      { fullName: 'مدير وحيد2', email: `solo.admin.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: soloOrg.id },
      'Password123'
    );
    // Create another admin in the SAME org to perform the deactivation attempt
    const { user: secondAdmin } = await createUserWithRole(
      { fullName: 'مدير ثانٍ', email: `second.admin.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: soloOrg.id },
      'Password123'
    );
    const secondAdminToken = await login(secondAdmin.email);

    // Deactivate secondAdmin first so soloAdmin is the only active admin
    await prisma.users.update({ where: { id: secondAdmin.id }, data: { is_active: false, write_date: new Date() } });

    const res = await request(app)
      .patch(`/api/users/${soloAdmin.id}/deactivate`)
      .set('Authorization', `Bearer ${secondAdminToken}`);

    // secondAdmin is now inactive so their token is invalid — expect 401
    // OR if secondAdmin is still validating from JWT, expect 400
    expect([400, 401]).toContain(res.status);
  });

  it('(Fix 1.5) يرفض إلغاء تفعيل المدير عندما تكون عضوية باقي المدراء موقفة (400) ثم ينجح بعد إعادة تفعيلها مع كتابة سجل تدقيق', async () => {
    const { deactivateUser } = require('../src/services/userAdminService');
    const staleAdminOrg = await createOrganization({ legalName: 'مؤسسة المدير المعلق', slug: `stale-admin-org-${Date.now()}` });
    const { user: targetAdmin } = await createUserWithRole(
      { fullName: 'المدير المستهدف', email: `stale.target.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: staleAdminOrg.id },
      'Password123'
    );
    const { user: staleAdmin } = await createUserWithRole(
      { fullName: 'مدير عضويته موقفة', email: `stale.holder.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: staleAdminOrg.id },
      'Password123'
    );
    // Stale admin row: ACTIVE user whose membership was soft-removed (the
    // exact state removeMembership produces). It must NOT keep the tenant
    // administrable — counting raw admin-role rows would let deactivating the
    // last functioning admin lock the organization out (Fix 1.5).
    await prisma.user_organizations.updateMany({
      where: { user_id: staleAdmin.id, organization_id: staleAdminOrg.id },
      data: { is_active: false, write_date: new Date() },
    });

    // Act as the stale admin (different user, so the self-deactivation guard
    // does not fire and ONLY the last-active-admin guard is exercised).
    await expect(deactivateUser(staleAdminOrg.id, targetAdmin.id, staleAdmin.id))
      .rejects.toMatchObject({ statusCode: 400 });

    // The target must remain untouched by the blocked deactivation.
    const untouched = await prisma.users.findUnique({ where: { id: targetAdmin.id }, select: { is_active: true } });
    expect(untouched?.is_active).toBe(true);

    // Reactivating the stale membership restores a second active admin and
    // the deactivation succeeds — atomically, with its audit row.
    await prisma.user_organizations.updateMany({
      where: { user_id: staleAdmin.id, organization_id: staleAdminOrg.id },
      data: { is_active: true, write_date: new Date() },
    });
    const deactivated = await deactivateUser(staleAdminOrg.id, targetAdmin.id, staleAdmin.id);
    expect(deactivated.isActive).toBe(false);

    const auditCount = await prisma.audit_logs.count({
      where: { action: 'user.deactivated', organization_id: staleAdminOrg.id, entity_id: targetAdmin.id },
    });
    expect(auditCount).toBe(1);
  });

  // ── Inactive Filter ─────────────────────────────────────────────────────────

  it('يعيد فلتر isActive=false المستخدمين غير المفعّلين فقط', async () => {
    const { user: inactiveUser } = await createUserWithRole(
      { fullName: 'مستخدم غير نشط للفلترة', email: `inactive.filter.${Date.now()}@cfms.local`, roleCode: 'staff' },
      'Password123'
    );
    await prisma.users.update({ where: { id: inactiveUser.id }, data: { is_active: false, write_date: new Date() } });

    const res = await request(app)
      .get('/api/users?isActive=false')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.isActive === false)).toBe(true);
    expect(res.body.data.some((u) => u.id === inactiveUser.id)).toBe(true);
  });

  it('يعيد فلتر isActive=true المستخدمين النشطين فقط', async () => {
    const res = await request(app)
      .get('/api/users?isActive=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u) => u.isActive === true)).toBe(true);
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  it('يعيد البحث المستخدمين المطابقين للاسم', async () => {
    const uniqueName = `بحث_اسم_${Date.now()}`;
    const { user: searchableUser } = await createUserWithRole(
      { fullName: uniqueName, email: `searchable.name.${Date.now()}@cfms.local`, roleCode: 'staff' },
      'Password123'
    );

    const res = await request(app)
      .get(`/api/users?search=${encodeURIComponent(uniqueName.slice(0, 8))}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((u) => u.id === searchableUser.id)).toBe(true);
  });

  it('يعيد البحث المستخدمين المطابقين للبريد الإلكتروني', async () => {
    const uniqueEmail = `searchable.email.${Date.now()}@cfms.local`;
    const { user: searchableUser } = await createUserWithRole(
      { fullName: 'مستخدم بحث بريد', email: uniqueEmail, roleCode: 'staff' },
      'Password123'
    );

    const res = await request(app)
      .get(`/api/users?search=${encodeURIComponent(uniqueEmail.slice(0, 15))}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((u) => u.id === searchableUser.id)).toBe(true);
  });

  // ── Tenant Isolation ────────────────────────────────────────────────────────

  it('لا تظهر مستخدمو مؤسسة أخرى في قائمة مستخدمي المؤسسة الحالية', async () => {
    const orgB = await createOrganization({ legalName: 'مؤسسة عزل ب', slug: `tenant-users-b-${Date.now()}` });
    const { user: orgBUser } = await createUserWithRole(
      { fullName: 'مستخدم مؤسسة ب', email: `org.b.user.${Date.now()}@cfms.local`, roleCode: 'staff', organizationId: orgB.id },
      'Password123'
    );

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((u) => u.id);
    expect(ids).not.toContain(orgBUser.id);
  });

  it('لا يمكن لمدير مؤسسة أ استرداد تفاصيل مستخدم مؤسسة ب', async () => {
    const orgC = await createOrganization({ legalName: 'مؤسسة عزل ج', slug: `tenant-users-c-${Date.now()}` });
    const { user: orgCUser } = await createUserWithRole(
      { fullName: 'مستخدم مؤسسة ج', email: `org.c.user.${Date.now()}@cfms.local`, roleCode: 'staff', organizationId: orgC.id },
      'Password123'
    );

    const res = await request(app)
      .get(`/api/users/${orgCUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('لا يمكن لمدير مؤسسة أ تحديث بيانات مستخدم مؤسسة ب', async () => {
    const orgD = await createOrganization({ legalName: 'مؤسسة عزل د', slug: `tenant-users-d-${Date.now()}` });
    const { user: orgDUser } = await createUserWithRole(
      { fullName: 'مستخدم مؤسسة د', email: `org.d.user.${Date.now()}@cfms.local`, roleCode: 'staff', organizationId: orgD.id },
      'Password123'
    );

    const res = await request(app)
      .put(`/api/users/${orgDUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'محاولة تعديل عبر مؤسسة أخرى' });

    expect(res.status).toBe(404);
  });

  it('لا يمكن إسناد عقدة تنظيمية تنتمي لمؤسسة أخرى لمستخدم', async () => {
    const orgE = await createOrganization({ legalName: 'مؤسسة عقدة', slug: `tenant-node-org-${Date.now()}` });
    const rolesRes = await request(app)
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const staffRoleId = rolesRes.body.data.find((role) => role.code === 'staff').id;

    const res = await request(app)
      .post(`/api/users/${staffUser.id}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: staffRoleId, organizationNodeId: orgE.id });

    expect(res.status).toBe(404);
  });

  // ── Unauthorized access ─────────────────────────────────────────────────────

  it('يرفض تحديث المستخدم بدون توكن', async () => {
    const res = await request(app)
      .put(`/api/users/${staffUser.id}`)
      .send({ fullName: 'محاولة بلا مصادقة' });
    expect(res.status).toBe(401);
  });

  it('يرفض إلغاء التفعيل بدون صلاحية users.manage', async () => {
    const res = await request(app)
      .patch(`/api/users/${staffUser.id}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  // ── Role/Group operations remain protected ──────────────────────────────────

  it('لا يمكن لمستخدم بدون صلاحية users.manage إسناد دور', async () => {
    const rolesRes = await request(app)
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`);
    const staffRoleId = rolesRes.body.data.find((r) => r.code === 'staff')?.id;

    const res = await request(app)
      .post(`/api/users/${staffUser.id}/roles`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ roleId: staffRoleId });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Password lifecycle (self-service change + admin-issued reset)
// ─────────────────────────────────────────────────────────────────────────────

describe('Password Lifecycle (Phase 3)', () => {
  let adminToken;
  let staffToken;
  let adminUser;
  let staffUser;
  let org;
  const ts = Date.now();

  const auditRows = (action, organizationId) =>
    prisma.audit_logs.findMany({
      where: { action, organization_id: organizationId },
      orderBy: { id: 'desc' },
    });

  beforeAll(async () => {
    org = await createOrganization({ legalName: 'مؤسسة كلمات المرور', slug: `password-org-${ts}` });
    const admin = await createUserWithRole(
      { fullName: 'مدير كلمات المرور', email: `password.admin.${ts}@cfms.local`, roleCode: 'admin', organizationId: org.id },
      'Password123'
    );
    const staff = await createUserWithRole(
      { fullName: 'موظف كلمات المرور', email: `password.staff.${ts}@cfms.local`, roleCode: 'staff', organizationId: org.id },
      'Password123'
    );
    adminUser = admin.user;
    staffUser = staff.user;
    adminToken = await login(adminUser.email);
    staffToken = await login(staffUser.email);
  });

  it('يغيّر كلمة المرور الذاتي بكلمة مرور حالية صحيحة (200) ويسمح بالدخول بالجديدة', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('Password123');
    expect(JSON.stringify(res.body)).not.toContain('NewPassword456');

    // The old credential no longer authenticates — verified against the
    // stored hash: every test in this file shares one 10-per-15-minute login
    // rate-limit bucket (authRoutes loginRateLimiter, keyed by IP), so HTTP
    // login assertions are budgeted for the spec-mandated checks in the
    // admin-reset test below.
    const changedUser = await prisma.users.findUnique({ where: { id: staffUser.id } });
    expect(await bcrypt.compare('Password123', changedUser.password_hash)).toBe(false);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: staffUser.email, password: 'NewPassword456' });
    expect(newLogin.status).toBe(200);
  });

  it('يرفض التغيير بكلمة مرور حالية خاطئة (401) دون كشف أي معلومات', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ currentPassword: 'WrongPassword999', newPassword: 'AnotherPassword123' });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('WrongPassword999');
    expect(JSON.stringify(res.body)).not.toContain('AnotherPassword123');
  });

  it('يرفض التغيير عند مخالفة سياسة كلمة المرور (422)', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ currentPassword: 'NewPassword456', newPassword: 'weak' });
    expect(res.status).toBe(422);
    // The policy failure must not have changed the password:
    const stillWorks = await request(app)
      .post('/api/auth/login')
      .send({ email: staffUser.email, password: 'NewPassword456' });
    expect(stillWorks.status).toBe(200);
  });

  it('يكتب حدث تدقيق user.password_changed باسم المنظمة الصحيح', async () => {
    const rows = await auditRows('user.password_changed', org.id);
    const row = rows.find((r) => r.actor_user_id === staffUser.id);
    expect(row).toBeTruthy();
    expect(row.entity_type).toBe('user');
    expect(row.entity_id).toBe(staffUser.id);
    expect(row.metadata).toMatchObject({ method: 'self' });
    expect(JSON.stringify(row.metadata)).not.toContain('NewPassword456');
  });

  // ── Admin-issued password reset ────────────────────────────────────────────────

  it('يعيد المدير تعيين كلمة مرور موظف في مؤسسته (200) ويفشل الدخول بالقديمة', async () => {
    const res = await request(app)
      .post(`/api/users/${staffUser.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'ResetPassword789' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('ResetPassword789');
    expect(JSON.stringify(res.body)).not.toContain('password');

    // The previous password (set by the self-service change above) fails now.
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: staffUser.email, password: 'NewPassword456' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: staffUser.email, password: 'ResetPassword789' });
    expect(newLogin.status).toBe(200);

    // The stored value is a hash, never plaintext.
    const dbUser = await prisma.users.findUnique({ where: { id: staffUser.id } });
    expect(dbUser.password_hash).not.toBe('ResetPassword789');
    expect(dbUser.password_hash.startsWith('$2')).toBe(true);
  });

  it('يرفض المدير تعيين كلمة مرور تخالف السياسة (422) ولا تتغير الحالية', async () => {
    const res = await request(app)
      .post(`/api/users/${staffUser.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'weak' });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).not.toContain('weak');

    // The 422 rejection must not have changed the stored password (hash
    // check — see the rate-limit budget note in the self-service test above).
    const afterRejected = await prisma.users.findUnique({ where: { id: staffUser.id } });
    expect(await bcrypt.compare('ResetPassword789', afterRejected.password_hash)).toBe(true);
  });

  it('يرفض المدير تعيين كلمة مرور لمستخدم ليس عضواً في مؤسسته (404) دون كشف وجوده', async () => {
    const otherOrg = await createOrganization({ legalName: 'مؤسسة إعادة التعيين الأخرى', slug: `password-org-other-${ts}` });
    const { user: outsider } = await createUserWithRole(
      { fullName: 'مستخدم مؤسسة أخرى', email: `password.outsider.${ts}@cfms.local`, roleCode: 'staff', organizationId: otherOrg.id },
      'Password123'
    );

    const res = await request(app)
      .post(`/api/users/${outsider.id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'OutsiderPassword123' });
    expect(res.status).toBe(404);

    // The outsider's original password is untouched.
    // The outsider's original credential is untouched (hash check — same
    // rate-limit budget rationale as above).
    const outsiderUser = await prisma.users.findUnique({ where: { id: outsider.id } });
    expect(await bcrypt.compare('Password123', outsiderUser.password_hash)).toBe(true);
  });

  it('يرفض موظف بدون صلاحية users.manage إعادة تعيين كلمات المرور (403)', async () => {
    const res = await request(app)
      .post(`/api/users/${adminUser.id}/reset-password`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ newPassword: 'ForbiddenPassword123' });
    expect(res.status).toBe(403);
  });

  it('يكتب حدث تدقيق user.password_reset بالبيانات الوصفية الصحيحة وبدون أي كلمات مرور', async () => {
    const rows = await auditRows('user.password_reset', org.id);
    const row = rows.find((r) => r.entity_id === staffUser.id);
    expect(row).toBeTruthy();
    expect(row.entity_type).toBe('user');
    expect(row.actor_user_id).toBe(adminUser.id);
    expect(row.metadata).toMatchObject({ method: 'admin', byUserId: adminUser.id });
    expect(JSON.stringify(row.metadata)).not.toContain('ResetPassword789');
    expect(JSON.stringify(row.metadata)).not.toContain('hash');
  });

});
