'use strict';

const { createUserWithRole, createOrganization } = require('./setup');
const request = require('supertest');
const app = require('../src/app');

describe('Groups / GroupRoles', () => {
  let org;
  let adminToken;
  let customRoleId;
  let groupId;
  let staffUserId;
  let staffToken;

  beforeAll(async () => {
    org = await createOrganization({ legalName: 'مؤسسة اختبار المجموعات', slug: 'test-org-groups' });

    const { user: admin } = await createUserWithRole(
      { fullName: 'مدير المجموعات', email: 'groups.admin@cfms.local', roleCode: 'admin', organizationId: org.id },
      'Password123'
    );
    const loginRes = await request(app).post('/api/auth/login').send({ email: admin.email, password: 'Password123' });
    adminToken = loginRes.body.data.token;

    // موظف بلا أي دور مباشر إطلاقاً - سيكتسب صلاحيته فقط عبر مجموعة
    const { user: staff } = await createUserWithRole(
      { fullName: 'موظف بلا دور مباشر', email: 'groups.staff@cfms.local', roleCode: 'staff', organizationId: org.id },
      'Password123'
    );
    staffUserId = staff.id;
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: staff.email, password: 'Password123' });
    staffToken = staffLoginRes.body.data.token;

    // دور مخصص جديد بصلاحية لا يملكها staff الافتراضي (لإثبات أن المجموعة أضافتها)
    const createRoleRes = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'org_units_viewer', nameAr: 'مُشاهد الهيكل التنظيمي' });
    customRoleId = createRoleRes.body.data.id;

    const permissionsRes = await request(app).get('/api/roles/permissions').set('Authorization', `Bearer ${adminToken}`);
    const orgStructureViewPermId = permissionsRes.body.data.find((p) => p.code === 'org_structure.view').id;

    await request(app)
      .put(`/api/roles/${customRoleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissionIds: [orgStructureViewPermId] });
  });

  it('ينشئ مجموعة جديدة ويربطها بدور مخصّص', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'structure_viewers', nameAr: 'مشاهدو الهيكل', roleIds: [customRoleId] });

    expect(res.status).toBe(201);
    expect(res.body.data.roles.some((r) => r.id === customRoleId)).toBe(true);
    groupId = res.body.data.id;
  });

  it('موظف بلا دور مباشر لا يملك صلاحية org_structure.view قبل الانضمام للمجموعة', async () => {
    const res = await request(app).get('/api/org-structure/unit-types').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('إضافة الموظف للمجموعة تمنحه الصلاحية فعلياً (عبر Group → GroupRole → Permission)', async () => {
    const addRes = await request(app)
      .post(`/api/users/${staffUserId}/groups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ groupId });
    expect(addRes.status).toBe(201);

    const res = await request(app).get('/api/org-structure/unit-types').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
  });

  it('إزالة الموظف من المجموعة تُلغي الصلاحية المكتسبة عبرها', async () => {
    const listRes = await request(app)
      .get(`/api/users/${staffUserId}/groups`)
      .set('Authorization', `Bearer ${adminToken}`);
    const userGroupId = listRes.body.data[0].id;

    await request(app).delete(`/api/users/groups/${userGroupId}`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app).get('/api/org-structure/unit-types').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('لا يمكن حذف مجموعة نظامية', async () => {
    const groupsRes = await request(app).get('/api/groups').set('Authorization', `Bearer ${adminToken}`);
    const systemGroup = groupsRes.body.data.find((g) => g.isSystem);
    expect(systemGroup).toBeDefined();

    const res = await request(app)
      .delete(`/api/groups/${systemGroup.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('عزل المؤسسات: مدير مؤسسة أخرى لا يرى مجموعة مؤسستنا الخاصة', async () => {
    const otherOrg = await createOrganization({ legalName: 'مؤسسة أخرى للمجموعات', slug: 'test-org-groups-other' });
    const { user: otherAdmin } = await createUserWithRole(
      { fullName: 'مدير آخر', email: 'groups.other.admin@cfms.local', roleCode: 'admin', organizationId: otherOrg.id },
      'Password123'
    );
    const otherLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: otherAdmin.email, password: 'Password123' });

    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${otherLoginRes.body.data.token}`);

    expect(res.body.data.some((g) => g.id === groupId)).toBe(false);
  });
});
