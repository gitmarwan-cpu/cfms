'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const { createOrganization, createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 2B platform tenant lifecycle API', () => {
  let platformAdmin;
  let platformToken;
  let tenantAdminToken;
  let tenantUserToken;
  let tenant;

  beforeAll(async () => {
    const now = new Date();
    platformAdmin = await prisma.users.create({
      data: {
        full_name: 'Phase 2B Platform Admin',
        email: `phase2b-platform-${unique()}@cfms.local`,
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

    tenant = await createOrganization({ legalName: 'Phase 2B Lifecycle Tenant', slug: `phase2b-${unique()}` });
    const tenantAdmin = await createUserWithRole({
      fullName: 'Phase 2B Tenant Admin',
      email: `phase2b-tenant-admin-${unique()}@cfms.local`,
      roleCode: 'admin',
      organizationId: tenant.id,
    });
    const tenantUser = await createUserWithRole({
      fullName: 'Phase 2B Tenant User',
      email: `phase2b-tenant-user-${unique()}@cfms.local`,
      roleCode: 'staff',
      organizationId: tenant.id,
    });
    tenantAdminToken = tokenFor(tenantAdmin.user.id);
    tenantUserToken = tokenFor(tenantUser.user.id);
  });

  const lifecycleUrl = (action, organizationId = tenant.id) => `/api/platform/tenants/${organizationId}/${action}`;

  it('rejects unauthenticated and tenant-scoped lifecycle requests', async () => {
    const unauthenticated = await request(app).patch(lifecycleUrl('suspend')).send({ reason: 'not allowed' });
    expect(unauthenticated.status).toBe(401);

    const tenantAdmin = await request(app)
      .patch(lifecycleUrl('suspend'))
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ reason: 'not allowed' });
    expect(tenantAdmin.status).toBe(403);

    const tenantUser = await request(app)
      .patch(lifecycleUrl('suspend'))
      .set('Authorization', `Bearer ${tenantUserToken}`)
      .send({ reason: 'not allowed' });
    expect(tenantUser.status).toBe(403);
  });

  it('rejects lifecycle transitions for child organization nodes without changing state or audit history', async () => {
    const now = new Date();
    const unitType = await prisma.org_unit_types.create({
      data: {
        organization_id: tenant.id,
        code: `phase2b-child-type-${unique()}`,
        name_ar: 'وحدة فرعية',
        name_en: 'Child Unit',
        hierarchy_level: 1,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const child = await prisma.organizations.create({
      data: {
        legal_name: 'Phase 2B Lifecycle Child',
        short_name: 'Child',
        slug: `phase2b-child-${unique()}`,
        parent_id: tenant.id,
        root_organization_id: tenant.id,
        org_unit_type_id: unitType.id,
        country: 'Yemen',
        governorate_id: tenant.governorate_id,
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        lifecycle_status: 'active',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const before = await prisma.organizations.findUnique({
      where: { id: child.id },
      select: {
        lifecycle_status: true,
        status_changed_at: true,
        status_changed_by_user_id: true,
        status_reason: true,
      },
    });

    const response = await request(app)
      .patch(lifecycleUrl('suspend', child.id))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Child must not be a tenant' });

    expect(response.status).toBe(404);
    const after = await prisma.organizations.findUnique({
      where: { id: child.id },
      select: {
        lifecycle_status: true,
        status_changed_at: true,
        status_changed_by_user_id: true,
        status_reason: true,
      },
    });
    expect(after).toEqual(before);
    expect(await prisma.audit_logs.count({
      where: {
        organization_id: child.id,
        action: 'organization.lifecycle.changed',
        entity_id: child.id,
      },
    })).toBe(0);
  });

  it('suspends an active tenant without requiring platform membership', async () => {
    const response = await request(app)
      .patch(lifecycleUrl('suspend'))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Operational pause' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      tenantId: tenant.id,
      lifecycleStatus: 'suspended',
      statusChangedByUserId: platformAdmin.id,
      statusReason: 'Operational pause',
    });
    expect(response.body.data.statusChangedAt).toBeTruthy();

    const platformMembership = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: platformAdmin.id, organization_id: tenant.id } },
    });
    expect(platformMembership).toBeNull();

    const operationalAccess = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${platformToken}`)
      .set('x-organization-id', String(tenant.id));
    expect(operationalAccess.status).toBe(403);
  });

  it('reactivates a suspended tenant', async () => {
    const response = await request(app)
      .patch(lifecycleUrl('reactivate'))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Pause ended' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      tenantId: tenant.id,
      lifecycleStatus: 'active',
      statusChangedByUserId: platformAdmin.id,
      statusReason: 'Pause ended',
    });
  });

  it('deactivates an active tenant and archives it after deactivation', async () => {
    const deactivated = await request(app)
      .patch(lifecycleUrl('deactivate'))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Tenant closed' });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data).toMatchObject({ lifecycleStatus: 'deactivated', tenantId: tenant.id });

    const archived = await request(app)
      .patch(lifecycleUrl('archive'))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Retention only' });
    expect(archived.status).toBe(200);
    expect(archived.body.data).toMatchObject({
      tenantId: tenant.id,
      lifecycleStatus: 'archived',
      statusChangedByUserId: platformAdmin.id,
      statusReason: 'Retention only',
    });

    for (const token of [tenantAdminToken, tenantUserToken, platformToken]) {
      const response = await request(app)
        .get('/api/organization')
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', String(tenant.id));
      expect(response.status).toBe(403);
    }
  });

  it('rejects invalid transitions, missing tenants, and invalid request data', async () => {
    const invalidTenant = await createOrganization({ legalName: 'Phase 2B Invalid Tenant', slug: `phase2b-invalid-${unique()}` });

    const invalidTransition = await request(app)
      .patch(lifecycleUrl('archive', invalidTenant.id))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Cannot skip states' });
    expect(invalidTransition.status).toBe(409);

    const notFound = await request(app)
      .patch(lifecycleUrl('suspend', 999999999))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Missing tenant' });
    expect(notFound.status).toBe(404);

    const invalidInput = await request(app)
      .patch('/api/platform/tenants/not-an-id/suspend')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Invalid identifier' });
    expect(invalidInput.status).toBe(422);

    const longReason = await request(app)
      .patch(lifecycleUrl('suspend', invalidTenant.id))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'x'.repeat(256) });
    expect(longReason.status).toBe(422);

    const archivedTerminal = await request(app)
      .patch(lifecycleUrl('reactivate'))
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reason: 'Archived is terminal' });
    expect(archivedTerminal.status).toBe(409);
  });

  it('preserves transition metadata and audit history', async () => {
    const audits = await prisma.audit_logs.findMany({
      where: { organization_id: tenant.id, action: 'organization.lifecycle.changed', entity_id: tenant.id },
      orderBy: { id: 'asc' },
      select: { actor_user_id: true, metadata: true },
    });

    expect(audits).toHaveLength(4);
    expect(audits.map((audit) => audit.metadata.nextStatus)).toEqual([
      'suspended',
      'active',
      'deactivated',
      'archived',
    ]);
    expect(audits.every((audit) => audit.actor_user_id === platformAdmin.id)).toBe(true);

    const organization = await prisma.organizations.findUnique({
      where: { id: tenant.id },
      select: { lifecycle_status: true, status_changed_at: true, status_changed_by_user_id: true, status_reason: true },
    });
    expect(organization).toMatchObject({
      lifecycle_status: 'archived',
      status_changed_by_user_id: platformAdmin.id,
      status_reason: 'Retention only',
    });
    expect(organization.status_changed_at).toBeInstanceOf(Date);
  });
});
