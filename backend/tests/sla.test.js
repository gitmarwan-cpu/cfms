'use strict';

require('./setup');

const request = require('supertest');
const app = require('../src/app');
const { createUserWithRole, createOrganization, getSeedGovernorateId, prisma } = require('./setup');

describe('SLA and escalation API', () => {
  let organization;
  let adminToken;
  let staffToken;
  let governorateId;
  let districtId;

  const createPublicComplaint = async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'وصف كافٍ لاختبار مهلة المعالجة والتصعيد عبر الواجهة')
      .field('consentGiven', 'true');
    expect(res.status).toBe(201);
    return res.body.data.id;
  };

  beforeAll(async () => {
    organization = await createOrganization({ legalName: 'مؤسسة SLA', slug: `sla-api-${Date.now()}` });
    const { user: admin } = await createUserWithRole(
      { fullName: 'مدير SLA', email: `sla.admin.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: organization.id },
      'Password123'
    );
    const { user: staff } = await createUserWithRole(
      { fullName: 'موظف SLA', email: `sla.staff.${Date.now()}@cfms.local`, roleCode: 'staff', organizationId: organization.id },
      'Password123'
    );
    const adminLogin = await request(app).post('/api/auth/login').send({ email: admin.email, password: 'Password123' });
    const staffLogin = await request(app).post('/api/auth/login').send({ email: staff.email, password: 'Password123' });
    adminToken = adminLogin.body.data.token;
    staffToken = staffLogin.body.data.token;
    governorateId = getSeedGovernorateId();
    const district = await prisma.districts.findFirst({ where: { governorate_id: governorateId, name_en: 'Yarim' } });
    districtId = district.id;

    const rule = await request(app)
      .post('/api/sla-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'قاعدة المعالجة الافتراضية',
        complaintType: 'complaint',
        firstResponseHours: 8,
        resolutionHours: 48,
        escalationIntervalHours: 24,
        maxEscalationLevel: 3,
      });
    expect(rule.status).toBe(201);
  });

  it('lists SLA rules for the authenticated organization', async () => {
    const listed = await request(app).get('/api/sla-rules').set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((item) => item.name === 'قاعدة المعالجة الافتراضية')).toBe(true);
  });

  it('rejects SLA rule creation without organization.manage', async () => {
    const res = await request(app)
      .post('/api/sla-rules')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'ممنوع',
        firstResponseHours: 1,
        resolutionHours: 2,
        escalationIntervalHours: 1,
      });
    expect(res.status).toBe(403);
  });

  it('applies due dates, evaluates overdue complaints, and records escalation notifications', async () => {
    const complaintId = await createPublicComplaint();
    const detail = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.slaStatus).toBe('on_track');
    expect(new Date(detail.body.data.slaDueAt).getTime()).toBeGreaterThan(new Date(detail.body.data.createdAt).getTime());

    const { user: assignee } = await createUserWithRole(
      {
        fullName: 'معالج SLA',
        email: `sla.assignee.${Date.now()}@cfms.local`,
        roleCode: 'staff',
        organizationId: organization.id,
      },
      'Password123'
    );
    const assignRes = await request(app)
      .patch(`/api/complaints/${complaintId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeUserId: assignee.id });
    expect(assignRes.status).toBe(200);

    await prisma.complaints.update({
      where: { id: complaintId },
      data: { sla_due_at: new Date(Date.now() - 60 * 1000) },
    });

    const evaluated = await request(app)
      .post('/api/sla-rules/evaluate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(evaluated.status).toBe(200);
    expect(evaluated.body.data.overdue).toBeGreaterThanOrEqual(1);
    expect(evaluated.body.data.escalated).toBeGreaterThanOrEqual(1);

    const after = await request(app)
      .get(`/api/complaints/${complaintId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.data.slaStatus).toBe('overdue');
    expect(after.body.data.escalationLevel).toBeGreaterThanOrEqual(1);
    expect(after.body.data.escalationEvents.length).toBeGreaterThanOrEqual(1);

    const notifications = await prisma.notifications.findMany({
      where: {
        organization_id: organization.id,
        user_id: assignee.id,
        notification_type: 'complaint.escalated',
        entity_id: complaintId,
      },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects complaint escalation without complaints.escalate', async () => {
    const complaintId = await createPublicComplaint();
    const res = await request(app)
      .post(`/api/complaints/${complaintId}/escalate`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ note: 'attempt' });
    expect(res.status).toBe(403);
  });

  it('manually escalates a complaint for an authorized administrator', async () => {
    const complaintId = await createPublicComplaint();
    const res = await request(app)
      .post(`/api/complaints/${complaintId}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'تصعيد يدوي' });
    expect(res.status).toBe(200);
    expect(res.body.data.escalationLevel).toBe(1);
    expect(res.body.data.escalationEvents[0]).toMatchObject({ reason: 'manual', toLevel: 1 });
  });

  it('creates priority-based SLA rules and applies them via public API', async () => {
    const priorityItem = await prisma.reference_list_items.findFirst({
      where: { code: 'high', reference_lists: { key: 'complaint_priority' } },
    });
    const ruleRes = await request(app)
      .post('/api/sla-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'قاعدة أولوية عالية',
        complaintType: 'complaint',
        priorityItemId: priorityItem.id,
        firstResponseHours: 4,
        resolutionHours: 24,
        escalationIntervalHours: 12,
        maxEscalationLevel: 3,
      });
    expect(ruleRes.status).toBe(201);
    expect(ruleRes.body.data.priorityItemId).toBe(priorityItem.id);

    const complaintRes = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('priority', 'high')
      .field('description', 'وصف شكوى ذات أولوية عالية واختبار المهلة الزمنية')
      .field('consentGiven', 'true');
    expect(complaintRes.status).toBe(201);

    const detailRes = await request(app)
      .get(`/api/complaints/${complaintRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.priority).toBe('high');
    expect(detailRes.body.data.slaRuleId).toBe(ruleRes.body.data.id);
  });
});
