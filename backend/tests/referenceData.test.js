'use strict';

const { createUserWithRole, createOrganization, getSeedGovernorateId, prisma } = require('./setup');
const request = require('supertest');
const app = require('../src/app');

describe('Reference Data API', () => {
  let adminToken;
  let organization;

  beforeAll(async () => {
    organization = await createOrganization({ legalName: 'مؤسسة البيانات المرجعية', slug: 'test-org-refdata' });

    const { user } = await createUserWithRole(
      { fullName: 'مدير النظام', email: 'ref.admin@cfms.local', roleCode: 'admin', organizationId: organization.id },
      'Password123'
    );

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Password123' });
    adminToken = res.body.data.token;
  });

  it('يعيد عناصر قائمة complaint_category المفعّلة بدون مصادقة عبر البوابة العامة', async () => {
    const res = await request(app).get(`/api/public/${organization.slug}/reference-data/complaint_category/items`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((item) => item.code === 'service_quality')).toBe(true);
  });

  it('يرفض الوصول لقائمة كل القوائم الإدارية بدون توكن', async () => {
    const res = await request(app).get('/api/reference-data');
    expect(res.status).toBe(401);
  });

  it('يسمح للـ admin بإضافة عنصر جديد إلى قائمة موجودة (يُنشئ نسخة خاصة بمؤسسته - Copy-on-Write)', async () => {
    const res = await request(app)
      .post('/api/reference-data/channel/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'whatsapp', labelAr: 'واتساب', labelEn: 'WhatsApp' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('whatsapp');

    const publicRes = await request(app).get(`/api/public/${organization.slug}/reference-data/channel/items`);
    expect(publicRes.body.data.some((item) => item.code === 'whatsapp')).toBe(true);
  });

  it('يمنع تكرار نفس الرمز (code) ضمن نسخة مؤسسته من نفس القائمة', async () => {
    const res = await request(app)
      .post('/api/reference-data/channel/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'website', labelAr: 'تكرار' });

    expect(res.status).toBe(409);
  });

  it('عند إلغاء تفعيل عنصر، يختفي من قائمة الاستهلاك العامة لنفس المؤسسة فقط', async () => {
    const createRes = await request(app)
      .post('/api/reference-data/channel/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'temp_channel', labelAr: 'قناة مؤقتة' });

    const itemId = createRes.body.data.id;

    await request(app)
      .patch(`/api/reference-data/channel/items/${itemId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    const publicRes = await request(app).get(`/api/public/${organization.slug}/reference-data/channel/items`);
    expect(publicRes.body.data.some((item) => item.code === 'temp_channel')).toBe(false);

    const adminRes = await request(app)
      .get('/api/reference-data/channel/items/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.find((item) => item.code === 'temp_channel')).toMatchObject({ isActive: false });

    const auditRes = await prisma.audit_logs.findFirst({
      where: { organization_id: organization.id, action: 'reference_item.deactivated', entity_id: itemId },
      orderBy: { created_at: 'desc' },
    });
    expect(auditRes).not.toBeNull();
  });

  it('يرفض إنشاء شكوى بتصنيف غير موجود ضمن reference_list_items', async () => {
    const districtId = 1;
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('governorateId', String(getSeedGovernorateId()))
      .field('districtId', String(districtId))
      .field('category', 'not_a_real_category')
      .field('description', 'نص وصف كافٍ لاختبار رفض تصنيف غير موجود فعلياً')
      .field('consentGiven', 'true');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
