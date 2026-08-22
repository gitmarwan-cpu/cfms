'use strict';

const setup = require('./setup');

const prisma = require('../src/prisma/client');
const userService = require('../src/services/userService.ts');

describe('Prisma user management service', () => {
  const unique = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  it('lists only users of the organization with roles, groups, and org unit', async () => {
    const org = await setup.createOrganization();
    const unitType = await prisma.org_unit_types.create({
      data: {
        organization_id: org.id,
        code: unique('unit-type'),
        name_ar: 'وحدة',
        name_en: 'Unit',
        hierarchy_level: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    const orgUnit = await prisma.org_units.create({
      data: {
        organization_id: org.id,
        org_unit_type_id: unitType.id,
        name: 'Service Unit',
        code: unique('SU'),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    await setup.createUserWithRole({
      fullName: 'Listed Admin',
      email: `${unique('listed-admin')}@cfms.local`,
      roleCode: 'admin',
      organizationId: org.id,
      orgUnitId: orgUnit.id,
    });

    const foreignOrg = await setup.createOrganization();
    await setup.createUserWithRole({
      fullName: 'Foreign User',
      email: `${unique('foreign-user')}@cfms.local`,
      roleCode: 'staff',
      organizationId: foreignOrg.id,
    });

    const result = await userService.listUsers(org.id, {});
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ fullName: 'Listed Admin', isActive: true });
    expect(result.data[0].roles).toHaveLength(1);
    expect(result.data[0].roles[0].code).toBe('admin');
    expect(result.data[0].groups).toEqual([]);
    expect(result.data[0].orgUnit).toMatchObject({ name: 'Service Unit' });
    expect(result.data.some((user) => user.email.startsWith('foreign-user-'))).toBe(false);
  });

  it('filters users by search term and active status', async () => {
    const org = await setup.createOrganization();
    await setup.createUserWithRole({
      fullName: 'Alpha Searchable',
      email: `${unique('alpha')}@cfms.local`,
      roleCode: 'staff',
      organizationId: org.id,
    });
    const beta = await setup.createUserWithRole({
      fullName: 'Beta Other',
      email: `${unique('beta')}@cfms.local`,
      roleCode: 'staff',
      organizationId: org.id,
    });
    await prisma.users.update({ where: { id: beta.user.id }, data: { is_active: false } });

    const byName = await userService.listUsers(org.id, { search: 'Alpha' });
    expect(byName.data).toHaveLength(1);
    expect(byName.data[0].fullName).toBe('Alpha Searchable');

    const byEmail = await userService.listUsers(org.id, { search: 'Beta' });
    expect(byEmail.data).toHaveLength(1);
    expect(byEmail.data[0].fullName).toBe('Beta Other');

    const inactive = await userService.listUsers(org.id, { isActive: 'false' });
    expect(inactive.data).toHaveLength(1);
    expect(inactive.data[0].fullName).toBe('Beta Other');

    const active = await userService.listUsers(org.id, { isActive: 'true' });
    expect(active.data).toHaveLength(1);
    expect(active.data[0].fullName).toBe('Alpha Searchable');
  });

  it('deactivates and reactivates a member and records audit events', async () => {
    const org = await setup.createOrganization();
    const target = await setup.createUserWithRole({
      fullName: 'Toggle User',
      email: `${unique('toggle')}@cfms.local`,
      roleCode: 'staff',
      organizationId: org.id,
    });
    const actor = await setup.createUserWithRole({
      fullName: 'Toggle Actor',
      email: `${unique('toggle-actor')}@cfms.local`,
      roleCode: 'admin',
      organizationId: org.id,
    });

    const deactivated = await userService.updateUserStatus(org.id, target.user.id, false, actor.user.id);
    expect(deactivated.isActive).toBe(false);

    const reactivated = await userService.updateUserStatus(org.id, target.user.id, true, actor.user.id);
    expect(reactivated.isActive).toBe(true);

    const audits = await prisma.audit_logs.findMany({
      where: {
        organization_id: org.id,
        entity_type: 'user',
        entity_id: target.user.id,
        action: { in: ['user.deactivated', 'user.activated'] },
      },
      orderBy: { id: 'asc' },
    });
    expect(audits.map((row) => row.action)).toEqual(['user.deactivated', 'user.activated']);
    expect(audits[0].actor_user_id).toBe(actor.user.id);
  });

  it('rejects status changes for users who are not members of the organization', async () => {
    const org = await setup.createOrganization();
    const foreignOrg = await setup.createOrganization();
    const foreignUser = await setup.createUserWithRole({
      fullName: 'Foreign Member',
      email: `${unique('foreign-member')}@cfms.local`,
      roleCode: 'staff',
      organizationId: foreignOrg.id,
    });
    const actor = await setup.createUserWithRole({
      fullName: 'Local Actor',
      email: `${unique('local-actor')}@cfms.local`,
      roleCode: 'admin',
      organizationId: org.id,
    });

    await expect(
      userService.updateUserStatus(org.id, foreignUser.user.id, false, actor.user.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects deactivating the last active organization admin', async () => {
    const org = await setup.createOrganization();
    const admin = await setup.createUserWithRole({
      fullName: 'Solo Admin',
      email: `${unique('solo-admin')}@cfms.local`,
      roleCode: 'admin',
      organizationId: org.id,
    });

    await expect(
      userService.updateUserStatus(org.id, admin.user.id, false, admin.user.id)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('lists users with pagination', async () => {
    const org = await setup.createOrganization();
    for (let index = 0; index < 3; index += 1) {
      await setup.createUserWithRole({
        fullName: `Paged User ${index}`,
        email: `${unique(`paged-${index}`)}@cfms.local`,
        roleCode: 'staff',
        organizationId: org.id,
      });
    }

    const page = await userService.listUsers(org.id, { page: '1', limit: '2' });
    expect(page.data).toHaveLength(2);
    expect(page.pagination).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
  });
});