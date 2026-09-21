'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const organizationService = require('../src/services/organizationService.ts');
const { createOrganization, createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const createPlatformUserWithPermission = async (permissionCode) => {
  const now = new Date();
  const suffix = unique();
  const permission = await prisma.permissions.findUnique({ where: { code: permissionCode } });
  expect(permission).toBeTruthy();

  const role = await prisma.roles.create({
    data: {
      code: `phase2d-${permissionCode.replaceAll('.', '-')}-${suffix}`,
      name_ar: `Phase 2D ${permissionCode}`,
      scope: 'platform',
      is_system: false,
      is_active: true,
      create_date: now,
      write_date: now,
    },
  });
  await prisma.role_permissions.create({
    data: { role_id: role.id, permission_id: permission.id, created_at: now },
  });

  const user = await prisma.users.create({
    data: {
      full_name: `Phase 2D ${permissionCode}`,
      email: `phase2d-${permissionCode.replaceAll('.', '-')}-${suffix}@cfms.local`,
      password_hash: 'not-used',
      is_active: true,
      create_date: now,
      write_date: now,
    },
  });
  await prisma.user_platform_roles.create({
    data: { user_id: user.id, role_id: role.id, create_date: now, write_date: now },
  });

  return { user, token: tokenFor(user.id) };
};

describe('Phase 2D hardening', () => {
  it('retires the legacy organization creation path without creating a tenant', async () => {
    const tenantAdmin = await createUserWithRole({
      fullName: 'Phase 2D Tenant Admin',
      email: `phase2d-tenant-admin-${unique()}@cfms.local`,
      roleCode: 'admin',
    });
    const slug = `phase2d-legacy-${unique()}`;

    const routeResponse = await request(app)
      .post('/api/organization')
      .set('Authorization', `Bearer ${tokenFor(tenantAdmin.user.id)}`)
      .send({ legalName: 'Legacy Path Tenant', slug });
    expect(routeResponse.status).toBe(404);

    await expect(organizationService.createOrganization({
      legalName: 'Legacy Path Tenant',
      slug,
    }, tenantAdmin.user.id)).rejects.toMatchObject({ statusCode: 403 });

    expect(await prisma.organizations.count({ where: { slug } })).toBe(0);
  });

  it('enforces the platform permission boundary between user and membership administration', async () => {
    const tenant = await createOrganization({ legalName: 'Phase 2D Matrix Tenant', slug: `phase2d-matrix-${unique()}` });
    const targetUser = await prisma.users.create({
      data: {
        full_name: 'Phase 2D Membership Target',
        email: `phase2d-target-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    const usersAdmin = await createPlatformUserWithPermission('platform.users.manage');
    const membershipsAdmin = await createPlatformUserWithPermission('platform.memberships.manage');

    const usersList = await request(app)
      .get('/api/platform/users')
      .set('Authorization', `Bearer ${usersAdmin.token}`);
    expect(usersList.status).toBe(200);

    const usersAdminMembershipAttempt = await request(app)
      .post(`/api/platform/tenants/${tenant.id}/users/${targetUser.id}/membership`)
      .set('Authorization', `Bearer ${usersAdmin.token}`);
    expect(usersAdminMembershipAttempt.status).toBe(403);

    const membershipsAdminUserAttempt = await request(app)
      .get('/api/platform/users')
      .set('Authorization', `Bearer ${membershipsAdmin.token}`);
    expect(membershipsAdminUserAttempt.status).toBe(403);

    const membership = await request(app)
      .post(`/api/platform/tenants/${tenant.id}/users/${targetUser.id}/membership`)
      .set('Authorization', `Bearer ${membershipsAdmin.token}`);
    expect(membership.status).toBe(201);

    const tenantCreationAttempt = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${usersAdmin.token}`)
      .send({});
    expect(tenantCreationAttempt.status).toBe(403);

    const lifecycleAttempt = await request(app)
      .patch(`/api/platform/tenants/${tenant.id}/suspend`)
      .set('Authorization', `Bearer ${membershipsAdmin.token}`)
      .send({ reason: 'Permission boundary test' });
    expect(lifecycleAttempt.status).toBe(403);
  });
});
