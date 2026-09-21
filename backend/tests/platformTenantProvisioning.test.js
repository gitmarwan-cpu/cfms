'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const { createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 2A platform tenant provisioning', () => {
  let platformAdmin;
  let platformToken;
  let tenantAdminToken;
  let tenantUserToken;

  beforeAll(async () => {
    const now = new Date();
    const passwordHash = await bcrypt.hash('Platform123', 10);
    platformAdmin = await prisma.users.create({
      data: {
        full_name: 'Phase 2A Platform Admin',
        email: `phase2a-platform-${unique()}@cfms.local`,
        password_hash: passwordHash,
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

    const tenantAdmin = await createUserWithRole({
      fullName: 'Phase 2A Tenant Admin',
      email: `phase2a-tenant-admin-${unique()}@cfms.local`,
      roleCode: 'admin',
    });
    const tenantUser = await createUserWithRole({
      fullName: 'Phase 2A Tenant User',
      email: `phase2a-tenant-user-${unique()}@cfms.local`,
      roleCode: 'staff',
    });
    tenantAdminToken = tokenFor(tenantAdmin.user.id);
    tenantUserToken = tokenFor(tenantUser.user.id);
  });

  const payload = (overrides = {}) => ({
    legalName: `Phase 2A Tenant ${unique()}`,
    slug: `phase-2a-${unique()}`,
    shortName: 'Phase 2A',
    initialAdmin: {
      fullName: 'Initial Tenant Admin',
      email: `initial-admin-${unique()}@cfms.local`,
      password: 'TenantAdmin123',
    },
    ...overrides,
  });

  it('rejects unauthenticated and tenant-scoped callers', async () => {
    const body = payload();
    await expect(request(app).post('/api/platform/tenants').send(body)).resolves.toMatchObject({ status: 401 });

    const tenantAdminResponse = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send(payload());
    expect(tenantAdminResponse.status).toBe(403);

    const tenantUserResponse = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${tenantUserToken}`)
      .send(payload());
    expect(tenantUserResponse.status).toBe(403);
  });

  it('provisions the tenant root, defaults, active admin membership, and tenant role atomically', async () => {
    const body = payload();
    const response = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`)
      .send(body);

    expect(response.status).toBe(201);
    const result = response.body.data;
    const organizationId = result.organization.id;
    const adminId = result.initialAdmin.id;

    const organization = await prisma.organizations.findUnique({ where: { id: organizationId } });
    expect(organization).toMatchObject({
      id: organizationId,
      legal_name: body.legalName,
      slug: body.slug,
      lifecycle_status: 'active',
      parent_id: null,
      root_organization_id: null,
      org_unit_type_id: null,
      is_active: true,
      default_language: 'ar',
      timezone: 'Asia/Aden',
      date_format: 'DD/MM/YYYY',
      anonymous_complaints_policy: 'allowed',
      notification_settings: {},
      status_changed_by_user_id: platformAdmin.id,
      status_reason: 'Provisioning completed',
    });

    const unitTypes = await prisma.org_unit_types.findMany({
      where: { organization_id: organizationId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, hierarchy_level: true, allowed_parent_type_id: true, is_active: true },
    });
    expect(unitTypes).toHaveLength(2);
    expect(unitTypes.map((item) => item.code)).toEqual(['branch_sector', 'department']);
    expect(unitTypes[0]).toMatchObject({ hierarchy_level: 1, is_active: true });
    expect(unitTypes[1]).toMatchObject({ hierarchy_level: 2, is_active: true });
    expect(unitTypes[1].allowed_parent_type_id).toBe(unitTypes[0].id);

    const admin = await prisma.users.findUnique({ where: { id: adminId } });
    expect(admin).toMatchObject({ email: body.initialAdmin.email.toLowerCase(), is_active: true, default_organization_id: organizationId });

    const membership = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: adminId, organization_id: organizationId } },
    });
    expect(membership).toMatchObject({ is_active: true, is_primary: true });

    const roleAssignment = await prisma.user_roles.findFirst({
      where: { user_id: adminId, organization_id: organizationId },
      include: { roles: true },
    });
    expect(roleAssignment).toBeTruthy();
    expect(roleAssignment.roles).toMatchObject({ code: 'admin', scope: 'tenant', organization_id: null });
    expect(await prisma.user_roles.count({ where: { user_id: adminId, organization_id: organizationId } })).toBe(1);
    expect(await prisma.user_platform_roles.count({ where: { user_id: adminId } })).toBe(0);

    const initialAdminToken = tokenFor(adminId);
    const usableResponse = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${initialAdminToken}`)
      .set('x-organization-id', String(organizationId));
    expect(usableResponse.status).toBe(200);

    const platformAccessResponse = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${initialAdminToken}`)
      .send(payload());
    expect(platformAccessResponse.status).toBe(403);
  });

  it('does not grant the creating Platform Admin tenant access automatically', async () => {
    const response = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`)
      .send(payload());
    expect(response.status).toBe(201);

    const organizationId = response.body.data.organization.id;
    const membership = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: platformAdmin.id, organization_id: organizationId } },
    });
    expect(membership).toBeNull();

    const tenantAccessResponse = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${platformToken}`)
      .set('x-organization-id', String(organizationId));
    expect(tenantAccessResponse.status).toBe(403);
  });

  it('rolls back the tenant and its provisioning records when the initial admin cannot be created', async () => {
    const existingUser = await prisma.users.findUnique({ where: { id: platformAdmin.id }, select: { email: true } });
    const body = payload({ initialAdmin: { fullName: 'Duplicate Admin', email: existingUser.email, password: 'TenantAdmin123' } });

    const response = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`)
      .send(body);
    expect(response.status).toBe(409);

    expect(await prisma.organizations.count({ where: { slug: body.slug } })).toBe(0);
  });
});
