'use strict';

const prisma = require('../src/prisma/client');
const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');
const { transitionTenantLifecycle } = require('../src/services/tenantLifecycleService.ts');

describe('Tenant lifecycle transition service', () => {
  let organization;
  let provisioningOrganization;
  let platformActor;
  let tenantActor;

  beforeAll(async () => {
    await prepareTestDatabase();
    const now = new Date();
    const platformRole = await prisma.roles.create({
      data: {
        code: 'phase1a_platform_lifecycle',
        name_ar: 'Phase 1A Platform Lifecycle',
        is_system: true,
        is_active: true,
        scope: 'platform',
        organization_id: null,
        create_date: now,
        write_date: now,
      },
    });
    const lifecyclePermission = await prisma.permissions.create({
      data: {
        code: 'platform.tenant.lifecycle',
        module: 'platform',
        description_ar: 'Lifecycle test permission',
        create_date: now,
        write_date: now,
      },
    });
    await prisma.role_permissions.create({
      data: { role_id: platformRole.id, permission_id: lifecyclePermission.id, created_at: now },
    });

    [platformActor, tenantActor] = await Promise.all([
      prisma.users.create({
        data: {
          full_name: 'Phase 1A Platform Actor',
          email: 'phase1a.platform.lifecycle@cfms.local',
          password_hash: 'not-used',
          is_active: true,
          create_date: now,
          write_date: now,
        },
      }),
      prisma.users.create({
        data: {
          full_name: 'Phase 1A Tenant Actor',
          email: 'phase1a.tenant.lifecycle@cfms.local',
          password_hash: 'not-used',
          is_active: true,
          create_date: now,
          write_date: now,
        },
      }),
    ]);
    await prisma.user_platform_roles.create({
      data: { user_id: platformActor.id, role_id: platformRole.id, create_date: now, write_date: now },
    });

    const organizationData = (slug, lifecycle_status = 'active') => ({
      legal_name: 'Phase 1A Lifecycle Organization',
      slug,
      country: 'Yemen',
      default_language: 'ar',
      timezone: 'Asia/Aden',
      date_format: 'DD/MM/YYYY',
      primary_color: '#0e5f66',
      secondary_color: '#0a464b',
      accent_color: '#c77b3f',
      anonymous_complaints_policy: 'allowed',
      notification_settings: {},
      lifecycle_status,
      is_active: true,
      create_date: now,
      write_date: now,
    });
    organization = await prisma.organizations.create({ data: organizationData('phase1a-lifecycle-org') });
    provisioningOrganization = await prisma.organizations.create({
      data: organizationData('phase1a-provisioning-org', 'provisioning'),
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('allows only the approved lifecycle transitions and writes metadata plus audit atomically', async () => {
    const suspended = await transitionTenantLifecycle(
      organization.id,
      'suspended',
      platformActor.id,
      'Operational pause'
    );
    expect(suspended).toMatchObject({
      id: organization.id,
      lifecycle_status: 'suspended',
      status_changed_by_user_id: platformActor.id,
      status_reason: 'Operational pause',
    });
    expect(suspended.status_changed_at).toBeInstanceOf(Date);

    const audit = await prisma.audit_logs.findFirst({
      where: {
        organization_id: organization.id,
        action: 'organization.lifecycle.changed',
        entity_id: organization.id,
      },
      orderBy: { id: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit.actor_user_id).toBe(platformActor.id);
    expect(audit.metadata).toMatchObject({
      previousStatus: 'active',
      nextStatus: 'suspended',
      reason: 'Operational pause',
    });

    await transitionTenantLifecycle(organization.id, 'active', platformActor.id, 'Pause ended');
    await transitionTenantLifecycle(organization.id, 'deactivated', platformActor.id, 'Tenant closed');
    const archived = await transitionTenantLifecycle(organization.id, 'archived', platformActor.id, 'Retention only');
    expect(archived).toMatchObject({
      lifecycle_status: 'archived',
      status_changed_by_user_id: platformActor.id,
      status_reason: 'Retention only',
    });

    const activated = await transitionTenantLifecycle(
      provisioningOrganization.id,
      'active',
      platformActor.id,
      'Initial activation'
    );
    expect(activated).toMatchObject({
      lifecycle_status: 'active',
      status_changed_by_user_id: platformActor.id,
      status_reason: 'Initial activation',
    });
  });

  it('rejects unauthorized actors and invalid transitions without changing state', async () => {
    await expect(
      transitionTenantLifecycle(provisioningOrganization.id, 'suspended', tenantActor.id, 'Not allowed')
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      transitionTenantLifecycle(provisioningOrganization.id, 'archived', platformActor.id, 'Skip states')
    ).rejects.toMatchObject({ statusCode: 409 });

    const unchanged = await prisma.organizations.findUnique({
      where: { id: provisioningOrganization.id },
      select: { lifecycle_status: true, status_changed_by_user_id: true, status_reason: true },
    });
    expect(unchanged).toEqual({
      lifecycle_status: 'active',
      status_changed_by_user_id: platformActor.id,
      status_reason: 'Initial activation',
    });
  });
});
