'use strict';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { default: app } = require('../src/app');
const { createUserWithRole, prisma } = require('./setup');

const unique = () => `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
const tokenFor = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Platform Role Lifecycle', () => {
  let platformAdminToken;
  let insufficientToken;
  let tenantAdminToken;
  let tenantAdmin;
  let platformAdminRole;
  
  beforeAll(async () => {
    const now = new Date();
    
    platformAdminRole = await prisma.roles.findFirst({
      where: { code: 'platform_admin', organization_id: null },
    });
    
    // Seed new permission if not seeded
    let rolesManagePerm = await prisma.permissions.findUnique({ where: { code: 'platform.roles.manage' } });
    if (!rolesManagePerm) {
      rolesManagePerm = await prisma.permissions.create({
        data: {
          code: 'platform.roles.manage',
          module: 'platform',
          description_ar: 'إدارة أدوار المنصة',
          create_date: now,
          write_date: now,
        },
      });
    }

    const platformAdmin = await prisma.users.create({
      data: {
        full_name: 'Platform Roles Admin',
        email: `platform-roles-admin-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const rolesAdminRole = await prisma.roles.create({
      data: {
        code: `platform_roles_manager_${unique()}`,
        name_ar: 'مدير أدوار المنصة',
        scope: 'platform',
        is_system: false,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.role_permissions.create({
      data: { role_id: rolesAdminRole.id, permission_id: rolesManagePerm.id, created_at: now },
    });
    await prisma.user_platform_roles.create({
      data: { user_id: platformAdmin.id, role_id: rolesAdminRole.id, create_date: now, write_date: now },
    });
    platformAdminToken = tokenFor(platformAdmin.id);

    const usersManagePerm = await prisma.permissions.findUnique({ where: { code: 'platform.users.manage' } });
    const insufficientUser = await prisma.users.create({
      data: {
        full_name: 'Platform Insufficient User',
        email: `platform-insufficient-${unique()}@cfms.local`,
        password_hash: 'not-used',
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    const usersOnlyRole = await prisma.roles.create({
      data: {
        code: `platform_users_manager_${unique()}`,
        name_ar: 'مدير مستخدمي المنصة فقط',
        scope: 'platform',
        is_system: false,
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });
    if (usersManagePerm) {
      await prisma.role_permissions.create({
        data: { role_id: usersOnlyRole.id, permission_id: usersManagePerm.id, created_at: now },
      });
    }
    await prisma.user_platform_roles.create({
      data: { user_id: insufficientUser.id, role_id: usersOnlyRole.id, create_date: now, write_date: now },
    });
    insufficientToken = tokenFor(insufficientUser.id);

    tenantAdmin = await createUserWithRole({
      fullName: 'Tenant Admin',
      email: `tenant-admin-${unique()}@cfms.local`,
      roleCode: 'admin',
    });
    tenantAdminToken = tokenFor(tenantAdmin.user.id);
  });

  it('verifies platform permission platform.roles.manage exists', async () => {
    const perm = await prisma.permissions.findUnique({ where: { code: 'platform.roles.manage' } });
    expect(perm).toBeDefined();
    expect(perm.module).toBe('platform');
  });

  it('rejects unauthorized and insufficient requests', async () => {
    const unauthenticated = await request(app).get('/api/platform/roles');
    expect(unauthenticated.status).toBe(401);

    const insufficient = await request(app)
      .get('/api/platform/roles')
      .set('Authorization', `Bearer ${insufficientToken}`);
    expect(insufficient.status).toBe(403);

    const tenantUser = await request(app)
      .get('/api/platform/roles')
      .set('Authorization', `Bearer ${tenantAdminToken}`);
    expect(tenantUser.status).toBe(403);
  });

  it('lists only platform roles and hides tenant roles', async () => {
    const response = await request(app)
      .get('/api/platform/roles')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'platform_admin', scope: 'platform', organizationId: null }),
    ]));
    
    // Ensure no tenant role (like 'admin') is returned
    const tenantRoles = response.body.data.filter(r => r.scope === 'tenant' || r.code === 'admin');
    expect(tenantRoles.length).toBe(0);
  });

  describe('Role Creation', () => {
    let tenantPerm;
    let platformPerm;

    beforeAll(async () => {
      tenantPerm = await prisma.permissions.findFirst({ where: { module: { not: 'platform' } } });
      platformPerm = await prisma.permissions.findFirst({ where: { module: 'platform' } });
    });

    it('creates a custom platform role with correct scope and organization_id', async () => {
      const payload = {
        code: `custom_plat_${unique()}`,
        nameAr: 'دور منصة مخصص',
        permissionIds: [],
      };
      
      const response = await request(app)
        .post('/api/platform/roles')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        code: payload.code,
        nameAr: payload.nameAr,
        scope: 'platform',
        organizationId: null,
        isSystem: false,
        isActive: true,
      });

      const auditLog = await prisma.audit_logs.findFirst({
        where: { action: 'platform_role.created', entity_id: response.body.data.id },
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.organization_id).toBeNull();
    });

    it('rejects assigning tenant permissions to a platform role', async () => {
      const payload = {
        code: `invalid_plat_${unique()}`,
        nameAr: 'دور غير صالح',
        permissionIds: [tenantPerm.id],
      };
      
      const response = await request(app)
        .post('/api/platform/roles')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send(payload);

      expect(response.status).toBe(403);
    });

    it('rejects mixing platform and tenant permissions', async () => {
      const payload = {
        code: `mixed_plat_${unique()}`,
        nameAr: 'مختلط غير صالح',
        permissionIds: [tenantPerm.id, platformPerm.id],
      };
      
      const response = await request(app)
        .post('/api/platform/roles')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send(payload);

      expect(response.status).toBe(403);
    });

    it('allows assigning platform permissions to a platform role', async () => {
      const payload = {
        code: `valid_plat_${unique()}`,
        nameAr: 'دور صالح',
        permissionIds: [platformPerm.id],
      };
      
      const response = await request(app)
        .post('/api/platform/roles')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.data.permissions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: platformPerm.id }),
      ]));
    });
  });

  describe('Role Updates and Lifecycle', () => {
    let customRole;
    let platformPerm;

    beforeAll(async () => {
      platformPerm = await prisma.permissions.findFirst({ where: { module: 'platform' } });
      const now = new Date();
      customRole = await prisma.roles.create({
        data: {
          code: `to_update_${unique()}`,
          name_ar: 'للتحديث',
          scope: 'platform',
          is_system: false,
          is_active: true,
          create_date: now,
          write_date: now,
        },
      });
    });

    it('updates name and description and logs audit', async () => {
      const response = await request(app)
        .put(`/api/platform/roles/${customRole.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          nameAr: 'تم التحديث',
          description: 'وصف جديد',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.nameAr).toBe('تم التحديث');

      const auditLog = await prisma.audit_logs.findFirst({
        where: { action: 'platform_role.updated', entity_id: customRole.id },
        orderBy: { id: 'desc' },
      });
      expect(auditLog).toBeDefined();
    });

    it('deactivates custom platform role', async () => {
      const response = await request(app)
        .put(`/api/platform/roles/${customRole.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          isActive: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);

      const dbRole = await prisma.roles.findUnique({ where: { id: customRole.id } });
      expect(dbRole.is_active).toBe(false);

      const auditLog = await prisma.audit_logs.findFirst({
        where: { action: 'platform_role.deactivated', entity_id: customRole.id },
      });
      expect(auditLog).toBeDefined();
    });

    it('reactivates custom platform role', async () => {
      const response = await request(app)
        .put(`/api/platform/roles/${customRole.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          isActive: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(true);
      
      const auditLog = await prisma.audit_logs.findFirst({
        where: { action: 'platform_role.activated', entity_id: customRole.id },
      });
      expect(auditLog).toBeDefined();
    });

    it('rejects modification of a tenant role via platform endpoints', async () => {
      const tenantRole = await prisma.roles.findFirst({ where: { scope: 'tenant' } });
      const response = await request(app)
        .put(`/api/platform/roles/${tenantRole.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ nameAr: 'تعديل اختراق' });

      expect(response.status).toBe(404);
    });

    it('rejects deactivating a system role', async () => {
      const response = await request(app)
        .put(`/api/platform/roles/${platformAdminRole.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(403);
    });

    it('rejects modifying permissions of a system role', async () => {
      const response = await request(app)
        .put(`/api/platform/roles/${platformAdminRole.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ permissionIds: [platformPerm.id] });

      expect(response.status).toBe(403);
    });
  });
});
