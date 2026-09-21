'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const { createOrganization, createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 2C platform user and membership administration', () => {
  let platformAdmin;
  let platformToken;
  let tenantAdminToken;
  let tenantUserToken;
  let membershipsOnlyToken;
  let usersOnlyToken;
  let managedTenant;
  let createdUserId;
  let membershipUser;
  let roleUser;

  beforeAll(async () => {
    const now = new Date();
    platformAdmin = await prisma.users.create({
      data: {
        full_name: 'Phase 2C Platform Admin',
        email: `phase2c-platform-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.user_platform_roles.create({
      data: {
        user_id: platformAdmin.id,
        role_id: global.__rbacRoles.platformAdminRole.id,
        create_date: now,
        write_date: now,
      },
    });
    platformToken = tokenFor(platformAdmin.id);

    const membershipsOnlyUser = await prisma.users.create({
      data: {
        full_name: 'Phase 2C Memberships Only',
        email: `phase2c-memberships-only-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const membershipsPermission = await prisma.permissions.findUnique({ where: { code: 'platform.memberships.manage' } });
    const membershipsRole = await prisma.roles.create({
      data: {
        code: `phase2c-memberships-only-${unique()}`,
        name_ar: 'Phase 2C Memberships Only',
        scope: 'platform',
        is_system: false,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.role_permissions.create({
      data: { role_id: membershipsRole.id, permission_id: membershipsPermission.id, created_at: now },
    });
    await prisma.user_platform_roles.create({
      data: { user_id: membershipsOnlyUser.id, role_id: membershipsRole.id, create_date: now, write_date: now },
    });
    membershipsOnlyToken = tokenFor(membershipsOnlyUser.id);

    const usersOnlyUser = await prisma.users.create({
      data: {
        full_name: 'Phase 2C Users Only',
        email: `phase2c-users-only-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const usersPermission = await prisma.permissions.findUnique({ where: { code: 'platform.users.manage' } });
    const usersRole = await prisma.roles.create({
      data: {
        code: `phase2c-users-only-${unique()}`,
        name_ar: 'Phase 2C Users Only',
        scope: 'platform',
        is_system: false,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.role_permissions.create({
      data: { role_id: usersRole.id, permission_id: usersPermission.id, created_at: now },
    });
    await prisma.user_platform_roles.create({
      data: { user_id: usersOnlyUser.id, role_id: usersRole.id, create_date: now, write_date: now },
    });
    usersOnlyToken = tokenFor(usersOnlyUser.id);

    managedTenant = await createOrganization({ legalName: 'Phase 2C Managed Tenant', slug: `phase2c-managed-${unique()}` });
    const tenantAdmin = await createUserWithRole({
      fullName: 'Phase 2C Tenant Admin',
      email: `phase2c-tenant-admin-${unique()}@cfms.local`,
      roleCode: 'admin',
    });
    const tenantUser = await createUserWithRole({
      fullName: 'Phase 2C Tenant User',
      email: `phase2c-tenant-user-${unique()}@cfms.local`,
      roleCode: 'staff',
    });
    tenantAdminToken = tokenFor(tenantAdmin.user.id);
    tenantUserToken = tokenFor(tenantUser.user.id);

    membershipUser = await createUserWithRole({
      fullName: 'Phase 2C Membership User',
      email: `phase2c-membership-${unique()}@cfms.local`,
      roleCode: 'staff',
    });
    roleUser = await createUserWithRole({
      fullName: 'Phase 2C Role User',
      email: `phase2c-role-${unique()}@cfms.local`,
      roleCode: 'staff',
    });
  });

  const tenantUserUrl = (userId, suffix = 'membership', organizationId = managedTenant.id) =>
    `/api/platform/tenants/${organizationId}/users/${userId}/${suffix}`;

  it('enforces platform-only user and membership authorization', async () => {
    const unauthenticated = await request(app).get('/api/platform/users');
    expect(unauthenticated.status).toBe(401);

    const tenantAdmin = await request(app)
      .get('/api/platform/users')
      .set('Authorization', `Bearer ${tenantAdminToken}`);
    expect(tenantAdmin.status).toBe(403);

    const tenantAdminDetail = await request(app)
      .get(`/api/platform/users/${membershipUser.user.id}`)
      .set('Authorization', `Bearer ${tenantAdminToken}`);
    expect(tenantAdminDetail.status).toBe(403);

    const tenantUser = await request(app)
      .post(tenantUserUrl(membershipUser.user.id))
      .set('Authorization', `Bearer ${tenantUserToken}`);
    expect(tenantUser.status).toBe(403);

    const tenantUserDetail = await request(app)
      .get(`/api/platform/users/${membershipUser.user.id}`)
      .set('Authorization', `Bearer ${tenantUserToken}`);
    expect(tenantUserDetail.status).toBe(403);
  });

  it('provides minimal membership user options with memberships permission only', async () => {
    const response = await request(app)
      .get('/api/platform/membership-user-options')
      .query({ search: 'Phase 2C Memberships Only', page: 1, limit: 20 })
      .set('Authorization', `Bearer ${membershipsOnlyToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual({
      id: expect.any(Number),
      fullName: 'Phase 2C Memberships Only',
      email: expect.stringContaining('phase2c-memberships-only-'),
    });
    expect(Object.keys(response.body.data[0]).sort()).toEqual(['email', 'fullName', 'id']);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });

    const tenantResponse = await request(app)
      .get('/api/platform/membership-user-options')
      .set('Authorization', `Bearer ${tenantAdminToken}`);
    expect(tenantResponse.status).toBe(403);
  });

  it('lists, views, and creates active platform users without membership or platform role assignment', async () => {
    const list = await request(app)
      .get('/api/platform/users')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((user) => user.id === platformAdmin.id)).toBe(true);

    const create = await request(app)
      .post('/api/platform/users')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ fullName: 'Phase 2C Created User', email: `phase2c-created-${unique()}@cfms.local`, password: 'CreatedUser123' });
    expect(create.status).toBe(201);
    createdUserId = create.body.data.id;
    expect(create.body.data).toMatchObject({ id: createdUserId, isActive: true, defaultOrganizationId: null });

    const createdMemberships = await prisma.user_organizations.count({ where: { user_id: createdUserId } });
    const createdPlatformRoles = await prisma.user_platform_roles.count({ where: { user_id: createdUserId } });
    expect(createdMemberships).toBe(0);
    expect(createdPlatformRoles).toBe(0);

    const view = await request(app)
      .get(`/api/platform/users/${createdUserId}`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(view.status).toBe(200);
    expect(view.body.data).toMatchObject({ id: createdUserId, memberships: [], tenantRoles: [], platformRoles: [] });
  });

  it('redacts membership and role details for users-only admins while retaining full detail for dual-permission admins', async () => {
    const detailUser = await createUserWithRole({
      fullName: `Phase 2C Detail User ${unique()}`,
      email: `phase2c-detail-${unique()}@cfms.local`,
      roleCode: 'staff',
      organizationId: managedTenant.id,
    });
    const now = new Date();
    await prisma.user_platform_roles.create({
      data: {
        user_id: detailUser.user.id,
        role_id: global.__rbacRoles.platformAdminRole.id,
        create_date: now,
        write_date: now,
      },
    });

    const usersOnly = await request(app)
      .get(`/api/platform/users/${detailUser.user.id}`)
      .set('Authorization', `Bearer ${usersOnlyToken}`);
    expect(usersOnly.status).toBe(200);
    expect(usersOnly.body.data).toMatchObject({
      id: detailUser.user.id,
      fullName: detailUser.user.full_name,
      memberships: [],
      tenantRoles: [],
      platformRoles: [],
    });

    const full = await request(app)
      .get(`/api/platform/users/${detailUser.user.id}`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(full.status).toBe(200);
    expect(full.body.data.memberships.length).toBeGreaterThan(0);
    expect(full.body.data.tenantRoles.length).toBeGreaterThan(0);
    expect(full.body.data.platformRoles.length).toBeGreaterThan(0);
  });

  it('activates and deactivates the global user account without changing memberships', async () => {
    const deactivate = await request(app)
      .patch(`/api/platform/users/${createdUserId}/deactivate`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.isActive).toBe(false);

    const activate = await request(app)
      .patch(`/api/platform/users/${createdUserId}/activate`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(activate.status).toBe(200);
    expect(activate.body.data.isActive).toBe(true);
    expect(await prisma.user_organizations.count({ where: { user_id: createdUserId } })).toBe(0);
  });

  it('adds, removes, reactivates, and makes a tenant membership primary', async () => {
    const add = await request(app)
      .post(tenantUserUrl(membershipUser.user.id))
      .set('Authorization', `Bearer ${platformToken}`);
    expect(add.status).toBe(201);
    expect(add.body.data).toMatchObject({ organizationId: managedTenant.id, isActive: true, isPrimary: false });

    const remove = await request(app)
      .delete(tenantUserUrl(membershipUser.user.id))
      .set('Authorization', `Bearer ${platformToken}`);
    expect(remove.status).toBe(200);
    expect(remove.body.data.isActive).toBe(false);

    const reactivate = await request(app)
      .post(tenantUserUrl(membershipUser.user.id))
      .set('Authorization', `Bearer ${platformToken}`);
    expect(reactivate.status).toBe(201);
    expect(reactivate.body.data.isActive).toBe(true);

    const primary = await request(app)
      .patch(tenantUserUrl(membershipUser.user.id, 'membership/primary'))
      .set('Authorization', `Bearer ${platformToken}`);
    expect(primary.status).toBe(200);
    expect(primary.body.data).toMatchObject({ organizationId: managedTenant.id, isPrimary: true });

    const membership = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: membershipUser.user.id, organization_id: managedTenant.id } },
    });
    expect(membership).toMatchObject({ is_active: true, is_primary: true });
  });

  it('assigns and changes only tenant-scoped roles, rejecting platform roles', async () => {
    const add = await request(app)
      .post(tenantUserUrl(roleUser.user.id))
      .set('Authorization', `Bearer ${platformToken}`);
    expect(add.status).toBe(201);

    const assign = await request(app)
      .post(tenantUserUrl(roleUser.user.id, 'roles'))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ roleId: global.__rbacRoles.staffRole.id });
    expect(assign.status).toBe(201);

    const change = await request(app)
      .patch(tenantUserUrl(roleUser.user.id, `roles/${assign.body.data.id}`))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ roleId: global.__rbacRoles.adminRole.id });
    expect(change.status).toBe(200);

    const platformRoleAttempt = await request(app)
      .post(tenantUserUrl(roleUser.user.id, 'roles'))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ roleId: global.__rbacRoles.platformAdminRole.id });
    expect(platformRoleAttempt.status).toBe(404);

    const assignment = await prisma.user_roles.findFirst({
      where: { user_id: roleUser.user.id, organization_id: managedTenant.id },
      include: { roles: true },
    });
    expect(assignment.roles).toMatchObject({ code: 'admin', scope: 'tenant' });
    expect(assignment.organization_id).toBe(managedTenant.id);
    expect(await prisma.user_platform_roles.count({ where: { user_id: roleUser.user.id } })).toBe(0);
  });

  it('does not grant the Platform Admin tenant access automatically', async () => {
    expect(await prisma.user_organizations.count({ where: { user_id: platformAdmin.id } })).toBe(0);

    const operationalAccess = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${platformToken}`)
      .set('x-organization-id', String(managedTenant.id));
    expect(operationalAccess.status).toBe(403);
  });

  it('blocks platform membership and role operations for suspended, deactivated, and archived tenants', async () => {
    for (const lifecycleStatus of ['suspended', 'deactivated', 'archived']) {
      const blockedTenant = await createOrganization({ legalName: `Phase 2C ${lifecycleStatus}`, slug: `phase2c-${lifecycleStatus}-${unique()}` });
      await prisma.organizations.update({ where: { id: blockedTenant.id }, data: { lifecycle_status: lifecycleStatus } });

      const membership = await request(app)
        .post(tenantUserUrl(createdUserId, 'membership', blockedTenant.id))
        .set('Authorization', `Bearer ${platformToken}`);
      expect(membership.status).toBe(403);

      const role = await request(app)
        .post(tenantUserUrl(createdUserId, 'roles', blockedTenant.id))
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ roleId: global.__rbacRoles.staffRole.id });
      expect(role.status).toBe(403);
      expect(await prisma.user_organizations.count({ where: { user_id: createdUserId, organization_id: blockedTenant.id } })).toBe(0);
    }
  });

  it('preserves last-admin and last-membership protections', async () => {
    const lastAdminTenant = await createOrganization({ legalName: 'Phase 2C Last Admin', slug: `phase2c-last-admin-${unique()}` });
    const lastAdmin = await createUserWithRole({
      fullName: 'Phase 2C Last Admin User',
      email: `phase2c-last-admin-user-${unique()}@cfms.local`,
      roleCode: 'admin',
      organizationId: lastAdminTenant.id,
    });

    const removeMembership = await request(app)
      .delete(tenantUserUrl(lastAdmin.user.id, 'membership', lastAdminTenant.id))
      .set('Authorization', `Bearer ${platformToken}`);
    expect(removeMembership.status).toBe(400);

    const deactivateAccount = await request(app)
      .patch(`/api/platform/users/${lastAdmin.user.id}/deactivate`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(deactivateAccount.status).toBe(400);

    const membership = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: lastAdmin.user.id, organization_id: lastAdminTenant.id } },
    });
    expect(membership.is_active).toBe(true);
    expect((await prisma.users.findUnique({ where: { id: lastAdmin.user.id }, select: { is_active: true } })).is_active).toBe(true);
  });

  it('preserves required platform, membership, and role audit records', async () => {
    const userAuditActions = await prisma.audit_logs.findMany({
      where: { actor_user_id: platformAdmin.id, entity_type: 'user', entity_id: createdUserId },
      select: { action: true },
    });
    expect(userAuditActions.map((audit) => audit.action)).toEqual(expect.arrayContaining([
      'user.created',
      'user.deactivated',
      'user.activated',
    ]));

    const tenantAuditActions = await prisma.audit_logs.findMany({
      where: { actor_user_id: platformAdmin.id, organization_id: managedTenant.id },
      select: { action: true },
    });
    expect(tenantAuditActions.map((audit) => audit.action)).toEqual(expect.arrayContaining([
      'membership.granted',
      'membership.revoked',
      'membership.primary_changed',
      'user_role.assigned',
      'user_role.changed',
    ]));
  });
});
