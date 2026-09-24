'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { default: app } = require('../src/app');
const { createOrganization, createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Phase 3F platform tenant discovery API', () => {
  let platformAdmin;
  let platformToken;
  let membershipsOnlyToken;
  let tenantToken;

  beforeAll(async () => {
    const now = new Date();
    platformAdmin = await prisma.users.create({
      data: {
        full_name: 'Phase 3F Platform Admin',
        email: `phase3f-platform-${unique()}@cfms.local`,
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
        full_name: 'Phase 3F Memberships Only',
        email: `phase3f-memberships-only-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const membershipsPermission = await prisma.permissions.findUnique({ where: { code: 'platform.memberships.manage' } });
    const membershipsRole = await prisma.roles.create({
      data: {
        code: `platform_memberships_only_${unique()}`,
        name_ar: 'Phase 3F Memberships Only',
        scope: 'platform',
        is_system: false,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.role_permissions.create({
      data: {
        role_id: membershipsRole.id,
        permission_id: membershipsPermission.id,
        created_at: now,
      },
    });
    await prisma.user_platform_roles.create({
      data: {
        user_id: membershipsOnlyUser.id,
        role_id: membershipsRole.id,
        create_date: now,
        write_date: now,
      },
    });
    membershipsOnlyToken = tokenFor(membershipsOnlyUser.id);

    const tenantUser = await createUserWithRole({
      fullName: 'Phase 3F Tenant Admin',
      email: `phase3f-tenant-${unique()}@cfms.local`,
      roleCode: 'admin',
    });
    tenantToken = tokenFor(tenantUser.user.id);
  });

  const createTenant = (overrides = {}) => createOrganization({
    legalName: `Phase 3F Tenant ${unique()}`,
    shortName: 'Phase 3F',
    slug: `phase-3f-${unique()}`,
    ...overrides,
  });

  it('requires platform lifecycle permission and does not use tenant authorization', async () => {
    const unauthenticated = await request(app).get('/api/platform/tenants');
    expect(unauthenticated.status).toBe(401);

    const tenantResponse = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(tenantResponse.status).toBe(403);

    const platformResponse = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(platformResponse.status).toBe(200);

    const membershipsOnlyResponse = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', `Bearer ${membershipsOnlyToken}`);
    expect(membershipsOnlyResponse.status).toBe(200);

    const lifecycleOnlyEndpoint = await request(app)
      .get('/api/platform/tenants/1')
      .set('Authorization', `Bearer ${membershipsOnlyToken}`);
    expect(lifecycleOnlyEndpoint.status).toBe(403);
  });

  it('lists root tenants only with fixed newest-first pagination, search, and lifecycle filtering', async () => {
    const first = await createTenant({ legalName: 'Phase 3F Alpha Root', shortName: 'Alpha', slug: `phase-3f-alpha-${unique()}` });
    const second = await createTenant({ legalName: 'Phase 3F Beta Root', shortName: 'Beta', slug: `phase-3f-beta-${unique()}` });
    await prisma.organizations.create({
      data: {
        legal_name: 'Phase 3F Hidden Branch',
        short_name: 'Branch',
        slug: `phase-3f-branch-${unique()}`,
        parent_id: first.id,
        root_organization_id: first.id,
        country: 'Yemen',
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    await prisma.organizations.update({ where: { id: second.id }, data: { lifecycle_status: 'suspended' } });

    const paged = await request(app)
      .get('/api/platform/tenants')
      .query({ search: 'Phase 3F', page: 1, limit: 1 })
      .set('Authorization', `Bearer ${platformToken}`);
    expect(paged.status).toBe(200);
    expect(paged.body.pagination).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.data[0].id).toBe(second.id);
    expect(paged.body.data[0]).not.toHaveProperty('parentId');

    const filtered = await request(app)
      .get('/api/platform/tenants')
      .query({ lifecycleStatus: 'suspended', search: 'Beta' })
      .set('Authorization', `Bearer ${platformToken}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0]).toMatchObject({ id: second.id, lifecycleStatus: 'suspended' });

    const invalid = await request(app)
      .get('/api/platform/tenants')
      .query({ limit: 101, lifecycleStatus: 'unknown' })
      .set('Authorization', `Bearer ${platformToken}`);
    expect(invalid.status).toBe(422);
  });

  it('returns a root tenant detail but not an organization node', async () => {
    const root = await createTenant({ legalName: 'Phase 3F Detail Root', slug: `phase-3f-detail-${unique()}` });
    const branch = await prisma.organizations.create({
      data: {
        legal_name: 'Phase 3F Detail Branch',
        short_name: 'Detail Branch',
        slug: `phase-3f-detail-branch-${unique()}`,
        parent_id: root.id,
        root_organization_id: root.id,
        country: 'Yemen',
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        anonymous_complaints_policy: 'allowed',
        notification_settings: { internal: 'hidden' },
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    const detail = await request(app)
      .get(`/api/platform/tenants/${root.id}`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id: root.id,
      legalName: 'Phase 3F Detail Root',
      parentId: null,
      rootOrganizationId: null,
      lifecycleStatus: 'active',
    });
    for (const forbiddenField of ['complaints', 'beneficiaries', 'memberships', 'roles', 'notificationSettings', 'timezone']) {
      expect(detail.body.data).not.toHaveProperty(forbiddenField);
    }

    const branchResponse = await request(app)
      .get(`/api/platform/tenants/${branch.id}`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(branchResponse.status).toBe(404);

    const missingResponse = await request(app)
      .get('/api/platform/tenants/999999999')
      .set('Authorization', `Bearer ${platformToken}`);
    expect(missingResponse.status).toBe(404);
  });

  it('returns populated country, governorate, district, and statusChangedByUser details for root tenant detail', async () => {
    const country = await prisma.countries.findFirst();
    const governorate = await prisma.governorates.findFirst();
    const district = await prisma.districts.findFirst();

    const tenantWithLocations = await createTenant({
      legalName: `Phase 3F Location Tenant ${unique()}`,
      slug: `phase3f-loc-${unique()}`,
    });
    const now = new Date();
    await prisma.organizations.update({
      where: { id: tenantWithLocations.id },
      data: {
        country_id: country ? country.id : undefined,
        governorate_id: governorate ? governorate.id : undefined,
        district_id: district ? district.id : undefined,
        status_changed_by_user_id: platformAdmin.id,
        status_changed_at: now,
        status_reason: 'Testing reference resolution',
      },
    });

    const response = await request(app)
      .get(`/api/platform/tenants/${tenantWithLocations.id}`)
      .set('Authorization', `Bearer ${platformToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: tenantWithLocations.id,
      legalName: tenantWithLocations.legalName || tenantWithLocations.legal_name,
      slug: tenantWithLocations.slug,
      statusChangedByUserId: platformAdmin.id,
      statusChangedByUser: expect.objectContaining({
        id: platformAdmin.id,
        fullName: 'Phase 3F Platform Admin',
      }),
    });

    if (country) {
      expect(response.body.data.country).toMatchObject({
        id: country.id,
        nameAr: country.name_ar,
      });
    }
    if (governorate) {
      expect(response.body.data.governorate).toMatchObject({
        id: governorate.id,
        nameAr: governorate.name_ar,
      });
    }
    if (district) {
      expect(response.body.data.district).toMatchObject({
        id: district.id,
        nameAr: district.name_ar,
      });
    }
  });

  it('does not treat malformed top-level organizations as root tenants', async () => {
    const anchor = await createTenant({ legalName: 'Phase 3F Root Invariant Anchor', slug: `phase3f-anchor-${unique()}` });
    const unitType = await prisma.org_unit_types.create({
      data: {
        organization_id: anchor.id,
        code: `phase3f-malformed-type-${unique()}`,
        name_ar: 'نوع اختبار',
        name_en: 'Test Type',
        hierarchy_level: 1,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    const malformed = await Promise.all([
      createTenant({ legalName: 'Phase 3F Malformed Root Organization', slug: `phase3f-malformed-root-${unique()}` }),
      createTenant({ legalName: 'Phase 3F Malformed Unit Organization', slug: `phase3f-malformed-unit-${unique()}` }),
      createTenant({ legalName: 'Phase 3F Malformed Both Organization', slug: `phase3f-malformed-both-${unique()}` }),
    ]);

    await prisma.organizations.update({
      where: { id: malformed[0].id },
      data: { root_organization_id: anchor.id },
    });
    await prisma.organizations.update({
      where: { id: malformed[1].id },
      data: { org_unit_type_id: unitType.id },
    });
    await prisma.organizations.update({
      where: { id: malformed[2].id },
      data: { root_organization_id: anchor.id, org_unit_type_id: unitType.id },
    });

    const list = await request(app)
      .get('/api/platform/tenants')
      .query({ search: 'phase3f-malformed-' })
      .set('Authorization', `Bearer ${platformToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);
    expect(list.body.pagination.total).toBe(0);

    for (const organization of malformed) {
      const detail = await request(app)
        .get(`/api/platform/tenants/${organization.id}`)
        .set('Authorization', `Bearer ${platformToken}`);
      expect(detail.status).toBe(404);

      const publicSettings = await request(app)
        .get(`/api/public/${organization.slug}/organization`);
      expect(publicSettings.status).toBe(404);

      const tenantUser = await createUserWithRole({
        fullName: `Phase 3F Malformed Tenant User ${organization.id}`,
        email: `phase3f-malformed-user-${organization.id}-${unique()}@cfms.local`,
        organizationId: organization.id,
      });
      const authenticatedSettings = await request(app)
        .get('/api/organization')
        .set('Authorization', `Bearer ${tokenFor(tenantUser.user.id)}`);
      expect(authenticatedSettings.status).toBe(403);
    }
  });
});
