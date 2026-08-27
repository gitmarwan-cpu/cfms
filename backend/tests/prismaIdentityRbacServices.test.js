'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma/client');
const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');
const authService = require('../src/services/authService.ts');
const roleService = require('../src/services/roleService.ts');
const userRoleService = require('../src/services/userRoleService.ts');
const rbacService = require('../src/services/rbacService.ts');

describe('Prisma identity and RBAC services', () => {
  let organization;
  let admin;
  let staff;
  let permission;
  let adminRole;
  let customRole;

  beforeAll(async () => {
    await prepareTestDatabase();
    const now = new Date();
    organization = await prisma.organizations.create({
      data: {
        legal_name: 'Identity RBAC Organization',
        slug: 'identity-rbac-organization',
        country: 'Yemen',
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        primary_color: '#0e5f66',
        secondary_color: '#0a464b',
        accent_color: '#c77b3f',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        is_active: true,
        create_date: now,
        write_date: now,
      },
    });

    const passwordHash = await bcrypt.hash('Password123', 10);
    [admin, staff] = await Promise.all([
      prisma.users.create({
        data: {
          full_name: 'RBAC Admin',
          email: 'prisma.rbac.admin@cfms.local',
          password_hash: passwordHash,
          is_active: true,
          default_organization_id: organization.id,
          create_date: now,
          write_date: now,
        },
      }),
      prisma.users.create({
        data: {
          full_name: 'RBAC Staff',
          email: 'prisma.rbac.staff@cfms.local',
          password_hash: passwordHash,
          is_active: true,
          default_organization_id: organization.id,
          create_date: now,
          write_date: now,
        },
      }),
    ]);

    await prisma.user_organizations.createMany({
      data: [admin, staff].map((user) => ({
        user_id: user.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        create_date: now,
        write_date: now,
      })),
    });

    permission = await prisma.permissions.create({
      data: {
        code: 'identity.test',
        module: 'identity',
        description_ar: 'Identity test permission',
        create_date: now,
        write_date: now,
      },
    });
    adminRole = await prisma.roles.create({
      data: {
        code: 'admin',
        name_ar: 'Administrator',
        is_system: true,
        is_active: true,
        organization_id: null,
        create_date: now,
        write_date: now,
      },
    });
    customRole = await prisma.roles.create({
      data: {
        code: 'identity_viewer',
        name_ar: 'Identity Viewer',
        is_system: false,
        is_active: true,
        organization_id: organization.id,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.role_permissions.create({
      data: { role_id: customRole.id, permission_id: permission.id, created_at: now },
    });
    await prisma.user_roles.create({
      data: {
        user_id: admin.id,
        role_id: adminRole.id,
        organization_id: organization.id,
        create_date: now,
        write_date: now,
      },
    });
    await prisma.user_roles.create({
      data: {
        user_id: staff.id,
        role_id: customRole.id,
        organization_id: organization.id,
        create_date: now,
        write_date: now,
      },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('preserves login, token role claims, and effective RBAC sources', async () => {
    const login = await authService.login('prisma.rbac.admin@cfms.local', 'Password123');
    expect(login.user).toMatchObject({ id: admin.id, email: admin.email });
    expect(login.user).not.toHaveProperty('passwordHash');
    expect(login.user.roleCodes).toContain('admin');

    expect(await rbacService.getEffectiveRoleCodes(staff.id)).toEqual(['identity_viewer']);
    expect(await rbacService.userHasPermission(staff.id, 'identity.test')).toBe(true);
    expect(await rbacService.getEffectivePermissions(staff.id)).toEqual([
      { code: 'identity.test', organizationId: organization.id, orgUnitId: null },
    ]);
  });

  it('lists and manages roles with permission replacement and isolation', async () => {
    const roles = await roleService.listRoles(String(organization.id));
    expect(roles.map((role) => role.code)).toEqual(['admin', 'identity_viewer']);
    expect((await roleService.getRoleById(organization.id, String(customRole.id))).permissions[0].code).toBe('identity.test');

    const created = await roleService.createRole(organization.id, {
      code: 'temporary_role',
      nameAr: 'Temporary Role',
      permissionIds: [String(permission.id)],
    });
    await expect(prisma.audit_logs.findFirst({
      where: { organization_id: organization.id, action: 'role.created', entity_id: created.id },
    })).resolves.not.toBeNull();
    const updated = await roleService.updateRole(organization.id, created.id, {
      nameAr: 'Updated Role',
      permissionIds: [],
    });
    expect(updated).toMatchObject({ nameAr: 'Updated Role', permissions: [] });
    await roleService.deleteRole(organization.id, created.id);
    await expect(roleService.getRoleById(organization.id, created.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('preserves direct tenant-scoped user roles', async () => {
    const userRoles = await userRoleService.listUserRoles(organization.id, String(admin.id));
    expect(userRoles[0].role.code).toBe('admin');

    const assigned = await userRoleService.assignRole(organization.id, {
      userId: staff.id,
      roleId: adminRole.id,
    });
    expect(assigned).toMatchObject({ userId: staff.id, organizationId: organization.id, roleId: adminRole.id });
    await userRoleService.revokeRole(organization.id, assigned.id);
  });
});
