'use strict';

const { createUserWithRole, createOrganization } = require('./setup');
const prisma = require('../src/prisma/client');
const request = require('supertest');
const app = require('../src/app');

describe('Groups compatibility and retirement freeze', () => {
  let org;
  let adminToken;
  let staffToken;
  let staffUserId;
  let customRoleId;
  let systemGroupId;

  beforeAll(async () => {
    org = await createOrganization({ legalName: 'مؤسسة اختبار تجميد المجموعات', slug: 'test-org-groups' });

    const { user: admin } = await createUserWithRole(
      { fullName: 'مدير المجموعات', email: 'groups.admin@cfms.local', roleCode: 'admin', organizationId: org.id },
      'Password123'
    );
    adminToken = (await request(app).post('/api/auth/login').send({ email: admin.email, password: 'Password123' }))
      .body.data.token;

    const { user: staff } = await createUserWithRole(
      { fullName: 'موظف التعيين المباشر', email: 'groups.staff@cfms.local', roleCode: 'staff', organizationId: org.id },
      'Password123'
    );
    staffUserId = staff.id;
    staffToken = (await request(app).post('/api/auth/login').send({ email: staff.email, password: 'Password123' }))
      .body.data.token;

    const createRoleRes = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'org_units_viewer', nameAr: 'مُشاهد الهيكل التنظيمي' });
    customRoleId = createRoleRes.body.data.id;

    const permissionsRes = await request(app)
      .get('/api/roles/permissions')
      .set('Authorization', `Bearer ${adminToken}`);
    const orgStructureViewPermId = permissionsRes.body.data.find((p) => p.code === 'org_structure.view').id;
    await request(app)
      .put(`/api/roles/${customRoleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissionIds: [orgStructureViewPermId] });

    const systemGroup = await prisma.groups.create({
      data: {
        code: 'complaint_officers',
        name_ar: 'موظفو معالجة الشكاوى',
        is_system: true,
        organization_id: null,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    await prisma.group_roles.create({
      data: { group_id: systemGroup.id, role_id: global.__rbacRoles.staffRole.id, created_at: new Date() },
    });

    const groupsRes = await request(app).get('/api/groups').set('Authorization', `Bearer ${adminToken}`);
    systemGroupId = groupsRes.body.data.find((group) => group.isSystem).id;
  });

  it('keeps existing Groups readable and tenant-scoped', async () => {
    const groupsRes = await request(app).get('/api/groups').set('Authorization', `Bearer ${adminToken}`);
    expect(groupsRes.status).toBe(200);
    expect(groupsRes.body.data.some((group) => group.id === systemGroupId)).toBe(true);

    const otherOrg = await createOrganization({ legalName: 'مؤسسة أخرى للمجموعات', slug: 'test-org-groups-other' });
    const { user: otherAdmin } = await createUserWithRole(
      { fullName: 'مدير آخر', email: 'groups.other.admin@cfms.local', roleCode: 'admin', organizationId: otherOrg.id },
      'Password123'
    );
    const otherToken = (await request(app).post('/api/auth/login').send({ email: otherAdmin.email, password: 'Password123' }))
      .body.data.token;
    const otherGroupsRes = await request(app).get('/api/groups').set('Authorization', `Bearer ${otherToken}`);
    expect(otherGroupsRes.body.data.some((group) => group.id === systemGroupId)).toBe(true);
  });

  it('freezes Group, GroupRole, and UserGroup mutation endpoints server-side', async () => {
    const frozenRequests = [
      request(app).post('/api/groups').set('Authorization', `Bearer ${adminToken}`).send({ code: 'new_group', nameAr: 'مجموعة جديدة' }),
      request(app).put(`/api/groups/${systemGroupId}`).set('Authorization', `Bearer ${adminToken}`).send({ nameAr: 'تعديل' }),
      request(app).delete(`/api/groups/${systemGroupId}`).set('Authorization', `Bearer ${adminToken}`),
      request(app).post(`/api/users/${staffUserId}/groups`).set('Authorization', `Bearer ${adminToken}`).send({ groupId: systemGroupId }),
      request(app).delete('/api/users/groups/999999').set('Authorization', `Bearer ${adminToken}`),
    ];

    const responses = await Promise.all(frozenRequests);
    expect(responses.map((response) => response.status)).toEqual([410, 410, 410, 410, 410]);
    expect(responses.every((response) => response.body.message.includes('مجمّدة'))).toBe(true);
  });

  it('authorizes through a direct UserRole without Group-derived permissions', async () => {
    const before = await request(app).get('/api/org-structure/unit-types').set('Authorization', `Bearer ${staffToken}`);
    expect(before.status).toBe(403);

    const assignRes = await request(app)
      .post(`/api/users/${staffUserId}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: customRoleId });
    expect(assignRes.status).toBe(201);

    const after = await request(app).get('/api/org-structure/unit-types').set('Authorization', `Bearer ${staffToken}`);
    expect(after.status).toBe(200);
  });
});
