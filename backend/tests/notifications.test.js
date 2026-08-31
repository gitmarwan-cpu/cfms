'use strict';

const { createOrganization, createUserWithRole, prisma } = require('./setup');

const request = require('supertest');
const app = require('../src/app');
const complaintService = require('../src/services/complaintService.ts');

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const makePayload = (locations, overrides = {}) => ({
  type: 'complaint',
  isAnonymous: true,
  governorateId: locations.governorateId,
  districtId: locations.districtId,
  category: 'service_quality',
  description: 'Notification lifecycle test complaint description.',
  consentGiven: true,
  ...overrides,
});

describe('Notifications API lifecycle', () => {
  let organization;
  let adminToken;
  let adminUserId;
  let assigneeToken;
  let assigneeUserId;
  let complaintId;

  beforeAll(async () => {
    organization = await createOrganization({ legalName: 'مؤسسة اختبار الإشعارات', slug: `notif-${unique()}` });

    const { user: admin } = await createUserWithRole(
      { fullName: 'مدير الإشعارات', email: `notif-admin-${unique()}@cfms.local`, roleCode: 'admin', organizationId: organization.id },
      'Password123'
    );
    const { user: assignee } = await createUserWithRole(
      { fullName: 'موظف الإشعارات', email: `notif-assignee-${unique()}@cfms.local`, roleCode: 'staff', organizationId: organization.id },
      'Password123'
    );
    adminUserId = admin.id;
    assigneeUserId = assignee.id;

    const [adminRes, assigneeRes] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: admin.email, password: 'Password123' }),
      request(app).post('/api/auth/login').send({ email: assignee.email, password: 'Password123' }),
    ]);
    adminToken = adminRes.body.data.token;
    assigneeToken = assigneeRes.body.data.token;

    const governorate = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
    const district = await prisma.districts.findFirst({ where: { governorate_id: governorate.id, name_en: 'Yarim' } });
    const created = await complaintService.createComplaint(
      organization.id,
      makePayload({ governorateId: String(governorate.id), districtId: String(district.id) })
    );
    complaintId = created.complaint.id;
  });

  it('ينشئ إشعاراً للمستخدم المعيّن عند الإسناد (notification creation + recipient resolution)', async () => {
    await complaintService.assignComplaint(
      organization.id,
      complaintId,
      { assigneeUserId: assigneeUserId },
      adminUserId
    );

    const notification = await prisma.notifications.findFirst({
      where: {
        organization_id: organization.id,
        entity_id: complaintId,
        notification_type: 'complaint.assigned',
        user_id: assigneeUserId,
      },
    });
    expect(notification).not.toBeNull();
    expect(notification.read_at).toBeNull();
    expect(notification.title).not.toBeNull();
  });

  it('يجلب المستخدم إشعاراته فقط مع عدد غير المقروء', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${assigneeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const own = res.body.data.find((n) => n.entityId === complaintId && n.userId === assigneeUserId);
    expect(own).toBeDefined();
    expect(own.readAt).toBeNull();
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(res.body.pagination).toBeDefined();
  });

  it('لا يعيد إشعارات مستخدم آخر (user scoping)', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((n) => n.userId === assigneeUserId)).toBe(false);
  });

  it('يعلّم الإشعار كمقروء ويحفظ الحالة ويحدّث العدد', async () => {
    const unreadRes = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${assigneeToken}`);
    const target = unreadRes.body.data.find((n) => n.entityId === complaintId);
    expect(target).toBeDefined();
    const before = unreadRes.body.unreadCount;

    const patchRes = await request(app)
      .patch(`/api/notifications/${target.id}/read`)
      .set('Authorization', `Bearer ${assigneeToken}`);
    expect(patchRes.status).toBe(200);

    const stored = await prisma.notifications.findUnique({ where: { id: target.id } });
    expect(stored.read_at).not.toBeNull();

    const afterRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${assigneeToken}`);
    expect(afterRes.body.unreadCount).toBe(before - 1);
    const readItem = afterRes.body.data.find((n) => n.id === target.id);
    expect(readItem.readAt).not.toBeNull();

    // unreadOnly filter no longer returns it
    const stillUnread = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${assigneeToken}`);
    expect(stillUnread.body.data.some((n) => n.id === target.id)).toBe(false);
  });

  it('يرفض وسم إشعار مستخدم آخر بالقراءة حتى بمعرفة المعرّف', async () => {
    const target = await prisma.notifications.findFirst({
      where: { user_id: assigneeUserId, organization_id: organization.id },
    });

    const res = await request(app)
      .patch(`/api/notifications/${target.id}/read`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    const stored = await prisma.notifications.findUnique({ where: { id: target.id } });
    expect(stored.read_at).not.toBeNull(); // unchanged by the unauthorized attempt
  });

  it('يرفض معرّف إشعار غير صالح (404)', async () => {
    const res = await request(app)
      .patch('/api/notifications/99999999/read')
      .set('Authorization', `Bearer ${assigneeToken}`);
    expect(res.status).toBe(404);
  });

  it('يحافظ على عزل المؤسسة: لا تُعاد إشعارات مؤسسة أخرى عند تغيير السياق', async () => {
    const otherOrg = await createOrganization({ legalName: 'مؤسسة إشعارات أخرى', slug: `notif-other-${unique()}` });
    await prisma.user_organizations.create({
      data: {
        user_id: assigneeUserId,
        organization_id: otherOrg.id,
        is_primary: false,
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${assigneeToken}`)
      .set('x-organization-id', String(otherOrg.id));

    expect(res.status).toBe(200);
    expect(res.body.data.some((n) => n.entityId === complaintId)).toBe(false);
    expect(res.body.unreadCount).toBe(0);
  });
});
