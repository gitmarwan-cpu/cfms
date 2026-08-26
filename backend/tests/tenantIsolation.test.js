'use strict';

const { createUserWithRole, createOrganization, getSeedGovernorateId, prisma } = require('./setup');
const request = require('supertest');
const app = require('../src/app');

/**
 * ============================================================
 * اختبارات عزل المؤسسات (Tenant Isolation)
 * ============================================================
 * الهدف: التأكد عملياً أن مستخدماً في المؤسسة "أ" لا يمكنه أبداً قراءة
 * أو تعديل بيانات المؤسسة "ب"، حتى لو خمّن المعرّفات (IDs) بدقة - وهو
 * الشرط الذي طُلب صراحة التحقق منه بالاختبار وليس بالمراجعة اليدوية فقط.
 */
describe('Tenant Isolation', () => {
  let orgA;
  let orgB;
  let adminAToken;
  let adminBToken;
  let complaintIdInOrgB;
  let governorateId;
  let districtId;

  beforeAll(async () => {
    orgA = await createOrganization({ legalName: 'مؤسسة أ', slug: 'tenant-org-a' });
    orgB = await createOrganization({ legalName: 'مؤسسة ب', slug: 'tenant-org-b' });

    const { user: adminA } = await createUserWithRole(
      { fullName: 'مدير أ', email: 'admin.a@cfms.local', roleCode: 'admin', organizationId: orgA.id },
      'Password123'
    );
    const { user: adminB } = await createUserWithRole(
      { fullName: 'مدير ب', email: 'admin.b@cfms.local', roleCode: 'admin', organizationId: orgB.id },
      'Password123'
    );

    const loginA = await request(app).post('/api/auth/login').send({ email: adminA.email, password: 'Password123' });
    const loginB = await request(app).post('/api/auth/login').send({ email: adminB.email, password: 'Password123' });
    adminAToken = loginA.body.data.token;
    adminBToken = loginB.body.data.token;

    governorateId = getSeedGovernorateId();
    const district = await prisma.districts.findFirst({ where: { governorate_id: governorateId } });
    districtId = district.id;

    // شكوى تخص مؤسسة "ب" حصراً، عبر بوابتها العامة
    const complaintRes = await request(app)
      .post(`/api/public/${orgB.slug}/complaints`)
      .field('type', 'complaint')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'شكوى تخص مؤسسة ب حصراً لاختبار عزل البيانات بين المؤسسات')
      .field('consentGiven', 'true');
    complaintIdInOrgB = complaintRes.body.data?.id;
  });

  it('لا يستطيع مدير مؤسسة "أ" رؤية شكوى تخص مؤسسة "ب" عبر التخمين المباشر للمعرّف', async () => {
    const res = await request(app)
      .get(`/api/complaints/${complaintIdInOrgB}`)
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(404); // ليس 403 - لإخفاء حتى وجود السجل من الأساس
  });

  it('قائمة الشكاوى لمدير مؤسسة "أ" لا تحتوي أي شكوى تابعة لمؤسسة "ب"', async () => {
    const res = await request(app).get('/api/complaints').set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((c) => c.id);
    expect(ids).not.toContain(complaintIdInOrgB);
  });

  it('لا يستطيع مدير مؤسسة "أ" تعديل حالة شكوى تخص مؤسسة "ب"', async () => {
    const res = await request(app)
      .patch(`/api/complaints/${complaintIdInOrgB}/status`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(404);
  });

  it('لا يستطيع مدير مؤسسة "أ" قراءة انتقالات شكوى تخص مؤسسة "ب"', async () => {
    const res = await request(app)
      .get(`/api/complaints/${complaintIdInOrgB}/transitions`)
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(404);
  });

  it('لا يستطيع مدير مؤسسة "أ" انتحال هوية مؤسسة "ب" عبر هيدر X-Organization-Id', async () => {
    const res = await request(app)
      .get('/api/complaints')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Organization-Id', String(orgB.id));

    expect(res.status).toBe(403);
  });

  it('تعديل إعدادات مؤسسة "أ" لا يؤثر إطلاقاً على إعدادات مؤسسة "ب"', async () => {
    await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ shortName: 'OrgA-Renamed' });

    const orgBSettings = await request(app)
      .get('/api/organization')
      .set('Authorization', `Bearer ${adminBToken}`);

    expect(orgBSettings.body.data.shortName).not.toBe('OrgA-Renamed');
  });

  it('عنصر بيانات مرجعية (Copy-on-Write) أضافته مؤسسة "أ" لا يظهر لمؤسسة "ب"', async () => {
    await request(app)
      .post('/api/reference-data/channel/items')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ code: 'org_a_only_channel', labelAr: 'قناة خاصة بمؤسسة أ' });

    const orgBItems = await request(app)
      .get(`/api/public/${orgB.slug}/reference-data/channel/items`);

    expect(orgBItems.body.data.some((i) => i.code === 'org_a_only_channel')).toBe(false);
  });

  it('لا يستطيع مدير مؤسسة "أ" إسناد دور لمستخدم لا ينتمي لمؤسسته', async () => {
    const { user: staffB } = await createUserWithRole(
      { fullName: 'موظف ب', email: 'staff.b@cfms.local', roleCode: 'staff', organizationId: orgB.id },
      'Password123'
    );

    const rolesRes = await request(app)
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminAToken}`);
    const adminRoleId = rolesRes.body.data.find((r) => r.code === 'admin').id;

    const res = await request(app)
      .post(`/api/users/${staffB.id}/roles`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ roleId: adminRoleId });

    // staffB ليس عضواً في مؤسسة "أ" إطلاقاً => 400 (غير عضو) وليس نجاحاً
    expect(res.status).toBe(400);
  });

  it('لا يستطيع مدير مؤسسة "أ" الوصول للهيكل التنظيمي الخاص بمؤسسة "ب"', async () => {
    await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ code: 'org_b_branch', nameAr: 'فرع مؤسسة ب', hierarchyLevel: 1 });

    const resA = await request(app)
      .get('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resA.body.data.some((t) => t.code === 'org_b_branch')).toBe(false);
  });

  it('لا يستطيع مدير مؤسسة "أ" قراءة أو تعديل قواعد مهلة المعالجة أو تصعيد شكاوى مؤسسة "ب"', async () => {
    const ruleB = await request(app)
      .post('/api/sla-rules')
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({
        name: 'قاعدة مؤسسة ب',
        firstResponseHours: 4,
        resolutionHours: 12,
        escalationIntervalHours: 6,
      });
    expect(ruleB.status).toBe(201);

    const listA = await request(app).get('/api/sla-rules').set('Authorization', `Bearer ${adminAToken}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data.some((rule) => rule.id === ruleB.body.data.id)).toBe(false);

    const patchA = await request(app)
      .patch(`/api/sla-rules/${ruleB.body.data.id}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ name: 'محاولة تعديل' });
    expect(patchA.status).toBe(404);

    const escalateA = await request(app)
      .post(`/api/complaints/${complaintIdInOrgB}/escalate`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ note: 'تصعيد عبر مؤسسة أخرى' });
    expect(escalateA.status).toBe(404);

    await prisma.complaints.update({
      where: { id: complaintIdInOrgB },
      data: { sla_due_at: new Date(Date.now() - 60 * 1000), sla_status: 'on_track' },
    });
    await request(app).post('/api/sla-rules/evaluate').set('Authorization', `Bearer ${adminAToken}`);
    const complaintB = await prisma.complaints.findUnique({ where: { id: complaintIdInOrgB } });
    expect(complaintB.escalation_level).toBe(0);
  });
});
