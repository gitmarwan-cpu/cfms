'use strict';

/**
 * Phase 3 — Membership Lifecycle & Role Fixes Integration Tests
 *
 * Covers:
 *   - POST   /users/:userId/memberships            (add / 409 duplicate / reactivation)
 *   - GET    /users/:userId/memberships            (tenant-scoped list)
 *   - DELETE /users/memberships/:membershipId      (soft delete + invariants)
 *   - PATCH  /users/memberships/:membershipId/primary (primary/default sync)
 *   - Last-membership / last-active-admin / self-removal protections (400)
 *   - Cross-tenant add/remove/primary-change → 404 (no existence leak)
 *   - Audit rows for every membership event (organization_id + metadata)
 *   - Transaction integrity: audit failure inside the transaction rolls back
 *     the mutation (no partial state)
 *   - Fix 1.1 regression: revokeRole counts only ACTIVE admins
 *   - Fix 1.2 regression: assignRole/revokeRole write audit events
 *   - Fix 1.3 regression: listUsers hides members with inactive membership
 */

const { createUserWithRole, createOrganization, getDefaultOrg, prisma } = require('./setup');
const request = require('supertest');
const app = require('../src/app');
const auditService = require('../src/services/auditService.ts');

const runId = Date.now();

const login = async (email, password = 'Password123') => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

const getAuditRows = (where) =>
  prisma.audit_logs.findMany({ where, orderBy: { created_at: 'desc' } });

describe('Phase 3 — Membership Lifecycle API', () => {
  let adminAToken; let adminAId; let orgAId;
  let adminBToken; let adminBId; let orgBId;
  let staffX; let staffXEmail;

  beforeAll(async () => {
    const orgA = await createOrganization({ legalName: 'مؤسسة العضويات أ', slug: `membership-org-a-${runId}` });
    const orgB = await createOrganization({ legalName: 'مؤسسة العضويات ب', slug: `membership-org-b-${runId}` });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const adminA = await createUserWithRole(
      { fullName: 'مدير أ للعضويات', email: `membership.admin.a.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgAId },
      'Password123'
    );
    adminAId = adminA.user.id;
    adminAToken = await login(adminA.user.email);

    const adminB = await createUserWithRole(
      { fullName: 'مدير ب للعضويات', email: `membership.admin.b.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgBId },
      'Password123'
    );
    adminBId = adminB.user.id;
    adminBToken = await login(adminB.user.email);

    staffXEmail = `membership.staff.x.${runId}@cfms.local`;
    const staffXResult = await createUserWithRole(
      { fullName: 'موظف مشترك', email: staffXEmail, roleCode: 'staff', organizationId: orgAId },
      'Password123'
    );
    staffX = staffXResult.user;
  });

  // ── Add membership ───────────────────────────────────────────────────────────

  it('يضيف المستخدم إلى المؤسسة الحالية ويسجّل حدث التدقيق والإشعار', async () => {
    const res = await request(app)
      .post(`/api/users/${staffX.id}/memberships`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(staffX.id);
    expect(res.body.data.organizationId).toBe(orgBId);
    expect(res.body.data.isActive).toBe(true);
    // staffX already has an active membership in A → not primary in B
    expect(res.body.data.isPrimary).toBe(false);

    const auditRows = await getAuditRows({
      action: 'membership.granted',
      organization_id: orgBId,
      entity_type: 'user_organization',
      entity_id: res.body.data.id,
    });
    expect(auditRows.length).toBe(1);
    expect(auditRows[0].actor_user_id).toBe(adminBId);
    expect(auditRows[0].metadata.userId).toBe(staffX.id);
    expect(auditRows[0].metadata.reactivated).toBe(false);

    // default organization must NOT change on a non-first membership
    const userAfter = await prisma.users.findUnique({ where: { id: staffX.id } });
    expect(userAfter.default_organization_id).toBe(orgAId);

    const notifications = await prisma.notifications.findMany({
      where: { organization_id: orgBId, user_id: staffX.id, notification_type: 'membership.granted' },
    });
    expect(notifications.length).toBe(1);
  });

  it('يرفض إضافة عضوية مكررة لمستخدم عضو نشط بالفعل (409)', async () => {
    const res = await request(app)
      .post(`/api/users/${staffX.id}/memberships`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('يرفض تماماً تمرير معرّف المؤسسة في جسم الطلب (422)', async () => {
    const res = await request(app)
      .post(`/api/users/${staffX.id}/memberships`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ organizationId: orgBId });
    expect(res.status).toBe(422);
  });

  it('يعيد 404 عند إضافة مستخدم غير موجود', async () => {
    const res = await request(app)
      .post('/api/users/999999/memberships')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('يعرض عضويات المستخدم مقيدة بنطاق المؤسسة الحالية', async () => {
    const resA = await request(app)
      .get(`/api/users/${staffX.id}/memberships`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(resA.status).toBe(200);
    expect(Array.isArray(resA.body.data)).toBe(true);
    expect(resA.body.data.length).toBe(1);
    expect(resA.body.data[0].organizationId).toBe(orgAId);
    expect(resA.body.data[0].isPrimary).toBe(true);

    const resB = await request(app)
      .get(`/api/users/${staffX.id}/memberships`)
      .set('Authorization', `Bearer ${adminBToken}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.length).toBe(1);
    expect(resB.body.data[0].organizationId).toBe(orgBId);
    expect(resB.body.data[0].isPrimary).toBe(false);
  });

  // ── Remove membership (soft delete) ──────────────────────────────────────────

  it('يلغي العضوية بحذف ناعم دون حذف الصف ويسجّل التدقيق والإشعار', async () => {
    const membershipBefore = await prisma.user_organizations.findFirst({
      where: { user_id: staffX.id, organization_id: orgBId },
    });
    expect(membershipBefore).not.toBeNull();
    expect(membershipBefore.is_active).toBe(true);

    const res = await request(app)
      .delete(`/api/users/memberships/${membershipBefore.id}`)
      .set('Authorization', `Bearer ${adminBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(membershipBefore.id);
    expect(res.body.data.isActive).toBe(false);

    // Soft delete: the SAME row must still exist, never hard-deleted.
    const membershipAfter = await prisma.user_organizations.findUnique({
      where: { id: membershipBefore.id },
    });
    expect(membershipAfter).not.toBeNull();
    expect(membershipAfter.is_active).toBe(false);

    const auditRows = await getAuditRows({
      action: 'membership.revoked',
      organization_id: orgBId,
      entity_type: 'user_organization',
      entity_id: membershipBefore.id,
    });
    expect(auditRows.length).toBe(1);
    expect(auditRows[0].actor_user_id).toBe(adminBId);
    expect(auditRows[0].metadata.userId).toBe(staffX.id);

    const notifications = await prisma.notifications.findMany({
      where: { organization_id: orgBId, user_id: staffX.id, notification_type: 'membership.revoked' },
    });
    expect(notifications.length).toBe(1);
  });

  // ── Reactivation (in place, same row) ────────────────────────────────────────

  it('يعيد تفعيل العضوية الملغاة في نفس الصف مع تدقيق reactivated=true', async () => {
    const inactive = await prisma.user_organizations.findFirst({
      where: { user_id: staffX.id, organization_id: orgBId },
    });
    expect(inactive).not.toBeNull();
    expect(inactive.is_active).toBe(false);

    const res = await request(app)
      .post(`/api/users/${staffX.id}/memberships`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({});

    expect(res.status).toBe(201);
    // REACTIVATION: the same row id — never a new row.
    expect(res.body.data.id).toBe(inactive.id);
    expect(res.body.data.isActive).toBe(true);
    // is_primary preserved (staffX still has an active membership in A).
    expect(res.body.data.isPrimary).toBe(false);

    // default organization must NOT change on a non-first reactivation.
    const userAfter = await prisma.users.findUnique({ where: { id: staffX.id } });
    expect(userAfter.default_organization_id).toBe(orgAId);

    const grantedRows = await getAuditRows({
      action: 'membership.granted',
      organization_id: orgBId,
      entity_type: 'user_organization',
      entity_id: inactive.id,
    });
    // First grant (reactivated:false) + reactivation (reactivated:true).
    expect(grantedRows.length).toBe(2);
    expect(grantedRows[0].metadata.reactivated).toBe(true);
    expect(grantedRows[1].metadata.reactivated).toBe(false);

    const notifications = await prisma.notifications.findMany({
      where: { organization_id: orgBId, user_id: staffX.id, notification_type: 'membership.granted' },
    });
    expect(notifications.length).toBe(2);
  });

  // ── Primary membership change ────────────────────────────────────────────────

  it('يعيّن العضوية الأساسية ويزامن default_organization_id ذرّياً', async () => {
    const membershipB = await prisma.user_organizations.findFirst({
      where: { user_id: staffX.id, organization_id: orgBId },
    });
    expect(membershipB.is_active).toBe(true);

    const res = await request(app)
      .patch(`/api/users/memberships/${membershipB.id}/primary`)
      .set('Authorization', `Bearer ${adminBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isPrimary).toBe(true);

    const userAfter = await prisma.users.findUnique({ where: { id: staffX.id } });
    expect(userAfter.default_organization_id).toBe(orgBId);

    const membershipA = await prisma.user_organizations.findFirst({
      where: { user_id: staffX.id, organization_id: orgAId },
    });
    expect(membershipA.is_primary).toBe(false);

    const auditRows = await getAuditRows({
      action: 'membership.primary_changed',
      organization_id: orgBId,
      entity_type: 'user_organization',
      entity_id: membershipB.id,
    });
    expect(auditRows.length).toBe(1);
    expect(auditRows[0].metadata.from).toBe(orgAId);
    expect(auditRows[0].metadata.to).toBe(orgBId);
  });

  // ── Cross-tenant protection (404, never 403 — no existence leak) ─────────────

  it('يرفض تغيير العضوية الأساسية لعضوية تخص مؤسسة أخرى (404)', async () => {
    const membershipB = await prisma.user_organizations.findFirst({
      where: { user_id: staffX.id, organization_id: orgBId },
    });
    const res = await request(app)
      .patch(`/api/users/memberships/${membershipB.id}/primary`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(res.status).toBe(404);
  });

  it('يرفض إلغاء عضوية تخص مؤسسة أخرى (404)', async () => {
    const membershipB = await prisma.user_organizations.findFirst({
      where: { user_id: staffX.id, organization_id: orgBId },
    });
    const res = await request(app)
      .delete(`/api/users/memberships/${membershipB.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(res.status).toBe(404);
  });

  it('قائمة عضويات مدير مؤسسة "أ" لا تكشف عضويات مؤسسة "ب" للمستخدم نفسه', async () => {
    const res = await request(app)
      .get(`/api/users/${adminBId}/memberships`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((m) => m.organizationId === orgAId)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  // ── Invariants: last-membership / last-active-admin / self-removal ──────────

  it('يرفض إزالة آخر عضوية نشطة للمستخدم (400)', async () => {
    const { user: soloStaff } = await createUserWithRole(
      { fullName: 'موظف العضوية الوحيدة', email: `membership.solo.staff.${runId}@cfms.local`, roleCode: 'staff', organizationId: orgAId },
      'Password123'
    );
    const membership = await prisma.user_organizations.findFirst({
      where: { user_id: soloStaff.id, organization_id: orgAId },
    });

    const res = await request(app)
      .delete(`/api/users/memberships/${membership.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('آخر عضوية');

    // The row must be untouched — no soft delete, no hard delete.
    const after = await prisma.user_organizations.findUnique({ where: { id: membership.id } });
    expect(after.is_active).toBe(true);
  });

  it('يرفض إزالة عضوية آخر مدير نشط — العدّ لا يحتسب المدراء غير المفعّلين (400) ثم يسمح بعد توفر مدير بديل (200)', async () => {
    // Org C: two admins, one of them INACTIVE → the active one is the last
    // ACTIVE admin (Fix 1.1 counting logic applied to membership removal).
    const orgC = await createOrganization({ legalName: 'مؤسسة العضويات ج', slug: `membership-org-c-${runId}` });
    const { user: keeperAdmin } = await createUserWithRole(
      { fullName: 'المدير الباقي', email: `membership.keeper.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgC.id },
      'Password123'
    );
    const { user: sleepingAdmin } = await createUserWithRole(
      { fullName: 'المدير النائم', email: `membership.sleeping.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgC.id },
      'Password123'
    );
    await prisma.users.update({ where: { id: sleepingAdmin.id }, data: { is_active: false, write_date: new Date() } });

    const keeperMembership = await prisma.user_organizations.findFirst({
      where: { user_id: keeperAdmin.id, organization_id: orgC.id },
    });
    const keeperToken = await login(keeperAdmin.email);

    // Give the keeper a second ACTIVE membership (org A) first, so removing the
    // org C membership does NOT trip the last-membership invariant — the block
    // below must come from the last-ACTIVE-ADMIN invariant specifically.
    const grantToOrgA = await request(app)
      .post(`/api/users/${keeperAdmin.id}/memberships`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({});
    expect(grantToOrgA.status).toBe(201);

    // Self-removal by the last active admin is blocked by the same invariant.
    const blocked = await request(app)
      .delete(`/api/users/memberships/${keeperMembership.id}`)
      .set('Authorization', `Bearer ${keeperToken}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toContain('مدير نشط');

    const stillActive = await prisma.user_organizations.findUnique({ where: { id: keeperMembership.id } });
    expect(stillActive.is_active).toBe(true);

    // Unblock: a second ACTIVE admin joins org C, so the keeper can leave.
    await createUserWithRole(
      { fullName: 'المدير الثاني النشط', email: `membership.second.active.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgC.id },
      'Password123'
    );

    const allowed = await request(app)
      .delete(`/api/users/memberships/${keeperMembership.id}`)
      .set('Authorization', `Bearer ${keeperToken}`);
    expect(allowed.status).toBe(200);

    const removed = await prisma.user_organizations.findUnique({ where: { id: keeperMembership.id } });
    expect(removed.is_active).toBe(false);

    const revokedRows = await getAuditRows({ action: 'membership.revoked', organization_id: orgC.id, entity_type: 'user_organization' });
    const revokedRow = revokedRows.find((r) => r.entity_id === keeperMembership.id);
    expect(revokedRow).toBeTruthy();
    expect(revokedRow.metadata.userId).toBe(keeperAdmin.id);
  });

  // ── Fix 1.1 regression: revokeRole counts only ACTIVE admins ────────────────

  it('(Fix 1.1) يمنع سحب دور المدير عندما يكون باقي المدراء غير مفعّلين (400) ويسمح بعد تفعيل مدير بديل', async () => {
    const orgD = await createOrganization({ legalName: 'مؤسسة الأدوار د', slug: `membership-org-d-${runId}` });
    const { user: activeAdmin } = await createUserWithRole(
      { fullName: 'مدير نشط للأدوار', email: `membership.role.active.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgD.id },
      'Password123'
    );
    const { user: inactiveAdmin } = await createUserWithRole(
      { fullName: 'مدير معطّل للأدوار', email: `membership.role.inactive.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgD.id },
      'Password123'
    );
    await prisma.users.update({ where: { id: inactiveAdmin.id }, data: { is_active: false, write_date: new Date() } });

    const assignment = await prisma.user_roles.findFirst({
      where: { user_id: activeAdmin.id, organization_id: orgD.id, roles: { code: 'admin' } },
    });
    expect(assignment).not.toBeNull();

    const token = await login(activeAdmin.email);
    const blocked = await request(app)
      .delete(`/api/users/roles/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(400);

    // The role row must be untouched by the blocked revoke.
    const stillThere = await prisma.user_roles.findUnique({ where: { id: assignment.id } });
    expect(stillThere).not.toBeNull();

    // Once a second ACTIVE admin exists, the revoke succeeds and is audited.
    await prisma.users.update({ where: { id: inactiveAdmin.id }, data: { is_active: true, write_date: new Date() } });
    const allowed = await request(app)
      .delete(`/api/users/roles/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(allowed.status).toBe(200);

    const revokedRows = await getAuditRows({
      action: 'user_role.revoked',
      organization_id: orgD.id,
      entity_type: 'user_role',
      entity_id: assignment.id,
    });
    expect(revokedRows.length).toBe(1);
    expect(revokedRows[0].metadata).toMatchObject({ userId: activeAdmin.id, roleCode: 'admin' });
  });

  // ── Fix 1.4 regression: revokeRole counts only admins with an ACTIVE membership ──

  it('(Fix 1.4) يمنع سحب دور المدير عندما تكون عضوية باقي المدراء موقفة (400) ويسمح بعد إعادة تفعيلها', async () => {
    const orgE = await createOrganization({ legalName: 'مؤسسة الأدوار هـ', slug: `membership-org-e-${runId}` });
    const { user: activeAdmin } = await createUserWithRole(
      { fullName: 'مدير العضوية النشطة', email: `membership.role.active.m.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgE.id },
      'Password123'
    );
    const { user: staleAdmin } = await createUserWithRole(
      { fullName: 'مدير عضويته موقفة', email: `membership.role.stale.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgE.id },
      'Password123'
    );
    // The stale admin row: ACTIVE user whose membership was soft-removed —
    // exactly the state removeMembership produces. This row must NOT keep the
    // tenant administrable (Fix 1.4).
    await prisma.user_organizations.updateMany({
      where: { user_id: staleAdmin.id, organization_id: orgE.id },
      data: { is_active: false, write_date: new Date() },
    });

    const assignment = await prisma.user_roles.findFirst({
      where: { user_id: activeAdmin.id, organization_id: orgE.id, roles: { code: 'admin' } },
    });
    expect(assignment).not.toBeNull();

    const token = await login(activeAdmin.email);
    const blocked = await request(app)
      .delete(`/api/users/roles/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(400);

    // The role row must be untouched by the blocked revoke.
    const stillThere = await prisma.user_roles.findUnique({ where: { id: assignment.id } });
    expect(stillThere).not.toBeNull();

    // Reactivating the stale membership restores a second active admin.
    await prisma.user_organizations.updateMany({
      where: { user_id: staleAdmin.id, organization_id: orgE.id },
      data: { is_active: true, write_date: new Date() },
    });
    const allowed = await request(app)
      .delete(`/api/users/roles/${assignment.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(allowed.status).toBe(200);
  });

  // ── Fix 1.2 regression: assignRole / revokeRole write audit events ───────────
  // ── Fix 1.2 regression: assignRole / revokeRole write audit events ───────────

  it('(Fix 1.2) يسجّل user_role.assigned و user_role.revoked في audit_logs بالبيانات الوصفية الصحيحة', async () => {
    const { user: roleStaff } = await createUserWithRole(
      { fullName: 'موظف تدقيق الأدوار', email: `membership.role.audit.${runId}@cfms.local`, roleCode: 'staff', organizationId: orgAId },
      'Password123'
    );
    const adminRole = await prisma.roles.findFirst({ where: { code: 'admin', is_system: true } });
    expect(adminRole).not.toBeNull();

    const assignRes = await request(app)
      .post(`/api/users/${roleStaff.id}/roles`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ roleId: adminRole.id });
    expect(assignRes.status).toBe(201);
    const assignmentId = assignRes.body.data.id;

    const assignedRows = await getAuditRows({
      action: 'user_role.assigned',
      organization_id: orgAId,
      entity_type: 'user_role',
      entity_id: assignmentId,
    });
    expect(assignedRows.length).toBe(1);
    expect(assignedRows[0].actor_user_id).toBe(adminAId);
    expect(assignedRows[0].metadata).toMatchObject({
      userId: roleStaff.id,
      roleId: adminRole.id,
      roleCode: 'admin',
    });

    const revokeRes = await request(app)
      .delete(`/api/users/roles/${assignmentId}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(revokeRes.status).toBe(200);

    const revokedRows = await getAuditRows({
      action: 'user_role.revoked',
      organization_id: orgAId,
      entity_type: 'user_role',
      entity_id: assignmentId,
    });
    expect(revokedRows.length).toBe(1);
    expect(revokedRows[0].metadata).toMatchObject({
      userId: roleStaff.id,
      roleId: adminRole.id,
      roleCode: 'admin',
    });
  });

  // ── Self-removal protection ──────────────────────────────────────────────────

  it('يرفض المستخدم إزالة عضويته عندما يكون آخر مدير نشط (400)، ويسمح لمدير آخر بإزالة عضويته غير الإدارية', async () => {
    const orgE = await createOrganization({ legalName: 'مؤسسة الإزالة الذاتية', slug: `self-removal-org-${runId}` });
    const { user: soloAdmin } = await createUserWithRole(
      { fullName: 'مدير ذاتي الإزالة', email: `self.removal.admin.${runId}@cfms.local`, roleCode: 'admin', organizationId: orgE.id },
      'Password123'
    );

    // A second active membership (org A) so the last-membership invariant
    // passes and ONLY the last-active-admin invariant is exercised.
    const joinA = await request(app)
      .post(`/api/users/${soloAdmin.id}/memberships`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({});
    expect(joinA.status).toBe(201);

    const token = await login(soloAdmin.email);

    // The org-E membership (default organization for this user).
    const ownList = await request(app)
      .get(`/api/users/${soloAdmin.id}/memberships`)
      .set('Authorization', `Bearer ${token}`);
    expect(ownList.status).toBe(200);
    const orgEMembership = ownList.body.data.find((m) => m.organizationId === orgE.id);
    expect(orgEMembership).toBeDefined();

    // Self-removal would leave org E with zero active admins → 400 (blocked),
    // and the membership row must remain active.
    const blocked = await request(app)
      .delete(`/api/users/memberships/${orgEMembership.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(400);

    const stillActive = await prisma.user_organizations.findUnique({ where: { id: orgEMembership.id } });
    expect(stillActive.is_active).toBe(true);

    // Positive control: their org-A membership carries no admin role in org A,
    // so an org-A admin may remove it without violating any invariant.
    const adminList = await request(app)
      .get(`/api/users/${soloAdmin.id}/memberships`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(adminList.status).toBe(200);
    const orgAMembership = adminList.body.data.find((m) => m.organizationId === orgAId);
    expect(orgAMembership).toBeDefined();

    const allowed = await request(app)
      .delete(`/api/users/memberships/${orgAMembership.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.isActive).toBe(false);
  });

  // ── Fix 1.3 regression: listUsers hides members with inactive membership ─────

  it('(Fix 1.3) يخفي قائمة المستخدمين عضواً أصبحت عضويته غير مفعّلة', async () => {
    const email = `membership.listhide.${runId}@cfms.local`;
    const { user: hiddenMember } = await createUserWithRole(
      { fullName: 'عضو مخفي لاحقاً', email, roleCode: 'staff', organizationId: orgAId },
      'Password123'
    );

    const before = await request(app)
      .get(`/api/users?search=${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(before.status).toBe(200);
    expect(before.body.data.some((u) => u.id === hiddenMember.id)).toBe(true);

    // Soft-deactivate the membership row (exactly what removeMembership does).
    const membership = await prisma.user_organizations.findFirst({
      where: { user_id: hiddenMember.id, organization_id: orgAId },
    });
    await prisma.user_organizations.update({
      where: { id: membership.id },
      data: { is_active: false, write_date: new Date() },
    });

    const after = await request(app)
      .get(`/api/users?search=${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(after.status).toBe(200);
    expect(after.body.data.some((u) => u.id === hiddenMember.id)).toBe(false);
  });

  // ── Transaction integrity: audit failure ⇒ full rollback ─────────────────────

  it('يتراجع بالكامل عن إضافة العضوية عند فشل كتابة حدث التدقيق داخل المعاملة (لا حالة جزئية)', async () => {
    const orgT = await createOrganization({ legalName: 'مؤسسة سلامة المعاملة', slug: `tx-integrity-org-${runId}` });
    const { user: txUser } = await createUserWithRole(
      { fullName: 'مستخدم سلامة المعاملة', email: `membership.tx.integrity.${runId}@cfms.local`, roleCode: 'staff', organizationId: orgAId },
      'Password123'
    );

    const membershipService = require('../src/services/membershipService.ts');
    const auditSpy = jest
      .spyOn(auditService, 'recordAuditEvent')
      .mockRejectedValue(new Error('audit persistence failure'));

    try {
      // recordAuditEvent runs INSIDE the addMembership transaction with the
      // transaction client — its failure must roll back the membership create.
      await expect(membershipService.addMembership(orgT.id, adminBId, txUser.id)).rejects.toThrow(
        'audit persistence failure'
      );
    } finally {
      auditSpy.mockRestore();
    }

    // No partial membership row may remain after the rollback.
    const leftover = await prisma.user_organizations.findFirst({
      where: { user_id: txUser.id, organization_id: orgT.id },
    });
    expect(leftover).toBeNull();

    // And no audit row either — mutation and audit succeed or fail together.
    const auditCount = await prisma.audit_logs.count({
      where: { action: 'membership.granted', organization_id: orgT.id },
    });
    expect(auditCount).toBe(0);

    // The service works normally once the failure is removed.
    const retry = await membershipService.addMembership(orgT.id, adminBId, txUser.id);
    expect(retry.isActive).toBe(true);
    const granted = await prisma.audit_logs.count({
      where: { action: 'membership.granted', organization_id: orgT.id },
    });
    expect(granted).toBe(1);
  });

  // ── Fix 2.3 regression: reserved system role codes can never be recreated ────

  it('(Fix 2.3) يرفض إنشاء دور مخصص بكود محجوز للنظام (admin/staff) ويبقى الدور النظامي وحيداً', async () => {
    // A tenant-scoped role with code 'admin' would shadow the global system
    // role inside every code-based server-side guard (last-admin protection,
    // auth middleware) and enable privilege escalation.
    for (const reservedCode of ['admin', 'staff']) {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ code: reservedCode, nameAr: `دور مخصص مزيف ${reservedCode}`, nameEn: 'Fake Custom Role' });
      expect(res.status).toBe(422);
    }

    // The system roles remain unique in their (code, organization_id=null) form
    // and no tenant-scoped shadow role was created.
    const shadows = await prisma.roles.findMany({
      where: { code: { in: ['admin', 'staff'] }, organization_id: orgAId },
    });
    expect(shadows).toHaveLength(0);
    const systemRoles = await prisma.roles.findMany({
      where: { code: { in: ['admin', 'staff'] }, organization_id: null },
    });
    expect(systemRoles).toHaveLength(2);

    // A legitimate custom code is still accepted (normal creation path intact).
    const ok = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ code: `auditor_${runId}`, nameAr: 'مراجع', nameEn: 'Auditor' });
    expect(ok.status).toBe(201);
  });

});
