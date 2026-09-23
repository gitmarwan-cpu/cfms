'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { default: app } = require('../src/app');
const { createOrganization, createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Platform audit visibility', () => {
  let platformAdmin;
  let platformToken;
  let insufficientToken;
  let tenantUserToken;
  let tenant;

  beforeAll(async () => {
    const now = new Date();
    platformAdmin = await prisma.users.create({
      data: {
        full_name: 'Platform Audit Admin',
        email: `platform-audit-admin-${unique()}@cfms.local`,
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

    const usersPermission = await prisma.permissions.findUnique({ where: { code: 'platform.users.manage' } });
    const insufficientUser = await prisma.users.create({
      data: {
        full_name: 'Platform Audit Insufficient User',
        email: `platform-audit-insufficient-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const usersOnlyRole = await prisma.roles.create({
      data: {
        code: `platform-audit-users-only-${unique()}`,
        name_ar: 'مستخدمو المنصة فقط',
        scope: 'platform',
        is_system: false,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.role_permissions.create({
      data: { role_id: usersOnlyRole.id, permission_id: usersPermission.id, created_at: now },
    });
    await prisma.user_platform_roles.create({
      data: { user_id: insufficientUser.id, role_id: usersOnlyRole.id, create_date: now, write_date: now },
    });
    insufficientToken = tokenFor(insufficientUser.id);

    tenant = await createOrganization({ legalName: 'Platform Audit Tenant', slug: `platform-audit-${unique()}` });
    const tenantUser = await createUserWithRole({
      fullName: 'Platform Audit Tenant User',
      email: `platform-audit-tenant-user-${unique()}@cfms.local`,
      roleCode: 'staff',
      organizationId: tenant.id,
    });
    tenantUserToken = tokenFor(tenantUser.user.id);

    await prisma.audit_logs.createMany({
      data: [
        {
          organization_id: null,
          actor_user_id: platformAdmin.id,
          action: 'platform_role.assigned',
          entity_type: 'user_platform_role',
          entity_id: 900001,
          metadata: { userId: 901, roleId: 902, roleCode: 'platform_admin', password: 'must-not-leak' },
          created_at: new Date(now.getTime() + 1000),
        },
        {
          organization_id: null,
          actor_user_id: platformAdmin.id,
          action: 'platform_role.revoked',
          entity_type: 'user_platform_role',
          entity_id: 900002,
          metadata: { userId: 901, roleId: 902, roleCode: 'platform_admin', token: 'must-not-leak' },
          created_at: new Date(now.getTime() + 2000),
        },
        {
          organization_id: tenant.id,
          actor_user_id: platformAdmin.id,
          action: 'tenant-only.audit.event',
          entity_type: 'organization',
          entity_id: tenant.id,
          metadata: { source: 'tenant' },
          created_at: new Date(now.getTime() + 3000),
        },
      ],
    });
  });

  it('allows a platform admin to read platform audit events only', async () => {
    const response = await request(app)
      .get('/api/platform/audit-logs')
      .set('Authorization', `Bearer ${platformToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'platform_role.assigned', organizationId: null }),
      expect.objectContaining({ action: 'platform_role.revoked', organizationId: null }),
    ]));
    expect(response.body.data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'tenant-only.audit.event' }),
    ]));
  });

  it('requires the platform audit permission and rejects tenant users', async () => {
    const insufficient = await request(app)
      .get('/api/platform/audit-logs')
      .set('Authorization', `Bearer ${insufficientToken}`);
    expect(insufficient.status).toBe(403);

    const tenantUser = await request(app)
      .get('/api/platform/audit-logs')
      .set('Authorization', `Bearer ${tenantUserToken}`);
    expect(tenantUser.status).toBe(403);

    const unauthenticated = await request(app).get('/api/platform/audit-logs');
    expect(unauthenticated.status).toBe(401);
  });

  it('does not expose sensitive metadata through platform audit responses', async () => {
    const response = await request(app)
      .get('/api/platform/audit-logs')
      .set('Authorization', `Bearer ${platformToken}`);

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body.data);
    expect(serialized).not.toContain('must-not-leak');
    expect(response.body.data.find((entry) => entry.action === 'platform_role.assigned').metadata).toMatchObject({
      userId: 901,
      roleId: 902,
      roleCode: 'platform_admin',
    });
  });
});
