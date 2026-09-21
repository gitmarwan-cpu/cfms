'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const { createOrganization, createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Platform membership and role discovery', () => {
  let platformToken;
  let tenantToken;
  let tenant;
  let activeMember;
  let inactiveMember;
  let branch;

  beforeAll(async () => {
    const now = new Date();
    const platformAdmin = await prisma.users.create({
      data: {
        full_name: 'Discovery Platform Admin',
        email: `discovery-platform-${unique()}@cfms.local`,
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

    tenant = await createOrganization({ legalName: 'Discovery Tenant', slug: `discovery-${unique()}` });
    const tenantAdmin = await createUserWithRole({
      fullName: 'Discovery Tenant Admin',
      email: `discovery-admin-${unique()}@cfms.local`,
      roleCode: 'admin',
      organizationId: tenant.id,
    });
    tenantToken = tokenFor(tenantAdmin.user.id);

    activeMember = await createUserWithRole({
      fullName: 'Searchable Active Member',
      email: `searchable-active-${unique()}@cfms.local`,
      roleCode: 'staff',
      organizationId: tenant.id,
    });
    inactiveMember = await createUserWithRole({
      fullName: 'Inactive Member',
      email: `inactive-member-${unique()}@cfms.local`,
      roleCode: 'staff',
      organizationId: tenant.id,
    });
    await prisma.user_organizations.update({
      where: { user_id_organization_id: { user_id: inactiveMember.user.id, organization_id: tenant.id } },
      data: { is_active: false },
    });

    await prisma.roles.create({
      data: {
        code: `discovery-role-${unique()}`,
        name_ar: 'دور اكتشاف',
        name_en: 'Discovery Role',
        description: 'Tenant-scoped test role',
        organization_id: tenant.id,
        scope: 'tenant',
        is_system: false,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });

    branch = await prisma.organizations.create({
      data: {
        legal_name: 'Discovery Branch',
        short_name: 'Branch',
        slug: `discovery-branch-${unique()}`,
        parent_id: tenant.id,
        root_organization_id: tenant.id,
        country: 'Yemen',
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
  });

  it('enforces platform authorization and does not require tenant context', async () => {
    for (const path of [
      `/api/platform/tenants/${tenant.id}/memberships`,
      `/api/platform/tenants/${tenant.id}/roles`,
      `/api/platform/tenants/${tenant.id}/organization-nodes`,
    ]) {
      const unauthenticated = await request(app).get(path);
      expect(unauthenticated.status).toBe(401);

      const tenantResponse = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(tenantResponse.status).toBe(403);

      const platformResponse = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${platformToken}`)
        .set('x-organization-id', '999999999');
      expect(platformResponse.status).toBe(200);
    }
  });

  it('lists memberships with pagination/search and bounded role data', async () => {
    const response = await request(app)
      .get(`/api/platform/tenants/${tenant.id}/memberships`)
      .query({ search: 'Searchable Active', page: 1, limit: 1 })
      .set('Authorization', `Bearer ${platformToken}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      userId: activeMember.user.id,
      organizationId: tenant.id,
      isActive: true,
      user: { id: activeMember.user.id, fullName: 'Searchable Active Member', isActive: true },
    });
    expect(response.body.data[0]).toHaveProperty('tenantRoles');
    expect(response.body.data[0]).not.toHaveProperty('passwordHash');
    expect(response.body.data[0]).not.toHaveProperty('complaints');
    expect(response.body.data[0].tenantRoles.every((role) => role.role.scope === 'tenant')).toBe(true);

    const all = await request(app)
      .get(`/api/platform/tenants/${tenant.id}/memberships`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(all.status).toBe(200);
    expect(all.body.pagination.total).toBeGreaterThanOrEqual(3);
    expect(all.body.data.some((membership) => membership.userId === inactiveMember.user.id && !membership.isActive)).toBe(true);
  });

  it('lists only assignable tenant roles and active nodes in the tenant tree', async () => {
    const roles = await request(app)
      .get(`/api/platform/tenants/${tenant.id}/roles`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(roles.status).toBe(200);
    expect(roles.body.data.length).toBeGreaterThan(0);
    expect(roles.body.data.every((role) => role.scope === 'tenant' && role.isActive)).toBe(true);
    expect(roles.body.data.some((role) => role.organizationId === tenant.id)).toBe(true);
    expect(roles.body.data.every((role) => !Object.prototype.hasOwnProperty.call(role, 'permissions'))).toBe(true);

    const nodes = await request(app)
      .get(`/api/platform/tenants/${tenant.id}/organization-nodes`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(nodes.status).toBe(200);
    expect(nodes.body.data.some((node) => node.id === tenant.id)).toBe(true);
    expect(nodes.body.data.some((node) => node.id === branch.id)).toBe(true);
    expect(nodes.body.data.every((node) => node.isActive)).toBe(true);
    expect(nodes.body.data[0]).not.toHaveProperty('email');
    expect(nodes.body.data[0]).not.toHaveProperty('address');
  });

  it('rejects non-root and inactive tenants for all discovery APIs', async () => {
    for (const suffix of ['memberships', 'roles', 'organization-nodes']) {
      const childResponse = await request(app)
        .get(`/api/platform/tenants/${branch.id}/${suffix}`)
        .set('Authorization', `Bearer ${platformToken}`);
      expect(childResponse.status).toBe(404);
    }

    const suspendedTenant = await createOrganization({ legalName: 'Suspended Discovery Tenant', slug: `suspended-discovery-${unique()}` });
    await prisma.organizations.update({ where: { id: suspendedTenant.id }, data: { lifecycle_status: 'suspended' } });
    for (const suffix of ['memberships', 'roles', 'organization-nodes']) {
      const response = await request(app)
        .get(`/api/platform/tenants/${suspendedTenant.id}/${suffix}`)
        .set('Authorization', `Bearer ${platformToken}`);
      expect(response.status).toBe(403);
    }
  });
});
