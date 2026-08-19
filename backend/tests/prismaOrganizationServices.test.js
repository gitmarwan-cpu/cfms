'use strict';

const prisma = require('../src/prisma/client');
const { prepareTestDatabase, closeTestDatabase } = require('./testDatabase');
const organizationService = require('../src/services/organizationService.ts');
const orgUnitTypeService = require('../src/services/orgUnitTypeService.ts');
const orgUnitService = require('../src/services/orgUnitService.ts');

describe('Prisma organization services', () => {
  let organization;
  let member;
  let parentType;
  let childType;
  let parentUnit;
  let childUnit;

  beforeAll(async () => {
    await prepareTestDatabase();
    const now = new Date();

    organization = await prisma.organizations.create({
      data: {
        legal_name: 'Prisma Organization',
        slug: 'prisma-organization-services',
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
        created_at: now,
        updated_at: now,
      },
    });

    member = await prisma.users.create({
      data: {
        full_name: 'Organization Member',
        email: 'prisma.organization.member@cfms.local',
        password_hash: 'not-used-in-service-test',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });

    await prisma.user_organizations.create({
      data: {
        user_id: member.id,
        organization_id: organization.id,
        is_primary: true,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('preserves organization lookup and update response contracts', async () => {
    const bySlug = await organizationService.getBySlug(organization.slug);
    expect(bySlug.id).toBe(organization.id);
    expect(bySlug.legalName).toBe('Prisma Organization');
    expect(bySlug).toHaveProperty('isActive', true);

    const own = await organizationService.getOwnOrganization(String(organization.id));
    expect(own).toMatchObject({ id: organization.id, slug: organization.slug });

    const updated = await organizationService.updateOrganization(String(organization.id), {
      primaryColor: '#123456',
      shortName: 'Prisma Org',
    });
    expect(updated).toMatchObject({ primaryColor: '#123456', shortName: 'Prisma Org' });
    expect(updated).not.toHaveProperty('governorate');
  });

  it('lists and validates organization unit types with tenant isolation', async () => {
    parentType = await orgUnitTypeService.createType(String(organization.id), {
      code: 'parent',
      nameAr: 'Parent',
      hierarchyLevel: 1,
    });
    childType = await orgUnitTypeService.createType(organization.id, {
      code: 'child',
      nameAr: 'Child',
      hierarchyLevel: 2,
      allowedParentTypeId: String(parentType.id),
    });

    const types = await orgUnitTypeService.listTypes(String(organization.id));
    expect(types.map((type) => type.code)).toEqual(['parent', 'child']);
    expect(types[1]).toMatchObject({ organizationId: organization.id, allowedParentTypeId: parentType.id });

    await expect(
      orgUnitTypeService.createType(organization.id, { code: 'parent', nameAr: 'Duplicate' })
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      orgUnitTypeService.createType(organization.id, {
        code: 'invalid-parent',
        nameAr: 'Invalid Parent',
        allowedParentTypeId: '999999',
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    const updated = await orgUnitTypeService.updateType(organization.id, String(childType.id), {
      nameAr: 'Updated Child',
    });
    expect(updated.nameAr).toBe('Updated Child');
  });

  it('enforces managers, parent compatibility, mapped relations, and soft deactivation', async () => {
    parentUnit = await orgUnitService.createUnit(String(organization.id), {
      orgUnitTypeId: String(parentType.id),
      name: 'Parent Unit',
      managerUserId: String(member.id),
    });

    childUnit = await orgUnitService.createUnit(organization.id, {
      orgUnitTypeId: childType.id,
      parentId: String(parentUnit.id),
      name: 'Child Unit',
    });

    const units = await orgUnitService.listUnits(String(organization.id));
    const listedParent = units.find((unit) => unit.id === parentUnit.id);
    expect(listedParent).toMatchObject({
      organizationId: organization.id,
      name: 'Parent Unit',
      unitType: { code: 'parent' },
      manager: { id: member.id, fullName: 'Organization Member' },
    });

    await expect(
      orgUnitService.createUnit(organization.id, {
        orgUnitTypeId: parentType.id,
        name: 'Invalid Manager',
        managerUserId: '999999',
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    await expect(
      orgUnitService.createUnit(organization.id, {
        orgUnitTypeId: childType.id,
        name: 'Missing Parent',
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    await expect(
      orgUnitService.updateUnit(organization.id, String(parentUnit.id), { parentId: parentUnit.id })
    ).rejects.toMatchObject({ statusCode: 422 });

    await expect(
      orgUnitService.deactivateUnit(organization.id, String(parentUnit.id))
    ).rejects.toMatchObject({ statusCode: 409 });

    const deactivatedChild = await orgUnitService.deactivateUnit(organization.id, childUnit.id);
    expect(deactivatedChild).toMatchObject({ id: childUnit.id, isActive: false });

    const deactivatedParent = await orgUnitService.deactivateUnit(organization.id, parentUnit.id);
    expect(deactivatedParent).toMatchObject({ id: parentUnit.id, isActive: false });
    expect(await orgUnitService.listUnits(organization.id)).toEqual([]);
  });
});
