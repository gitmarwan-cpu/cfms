'use strict';

require('./setup');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { User } = require('../src/models');

describe('Reference Data API', () => {
  let adminToken;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('Password123', 10);
    const admin = await User.create({
      fullName: 'مدير النظام',
      email: 'ref.admin@cfms.local',
      passwordHash,
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'Password123' });
    adminToken = res.body.data.token;
  });

  it('يعيد عناصر قائمة complaint_category المفعّلة بدون مصادقة', async () => {
    const res = await request(app).get('/api/reference-data/complaint_category/items');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((item) => item.code === 'service_quality')).toBe(true);
  });

  it('يرفض الوصول لقائمة كل القوائم بدون توكن admin', async () => {
    const res = await request(app).get('/api/reference-data');
    expect(res.status).toBe(401);
  });

  it('يسمح للـ admin بإضافة عنصر جديد إلى قائمة موجودة', async () => {
    const res = await request(app)
      .post('/api/reference-data/channel/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'whatsapp', labelAr: 'واتساب', labelEn: 'WhatsApp' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('whatsapp');

    const publicRes = await request(app).get('/api/reference-data/channel/items');
    expect(publicRes.body.data.some((item) => item.code === 'whatsapp')).toBe(true);
  });

  it('يمنع تكرار نفس الرمز (code) ضمن نفس القائمة', async () => {
    const res = await request(app)
      .post('/api/reference-data/channel/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'website', labelAr: 'تكرار' });

    expect(res.status).toBe(409);
  });

  it('عند إلغاء تفعيل عنصر، يختفي من قائمة الاستهلاك العامة', async () => {
    const createRes = await request(app)
      .post('/api/reference-data/channel/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'temp_channel', labelAr: 'قناة مؤقتة' });

    const itemId = createRes.body.data.id;

    await request(app)
      .patch(`/api/reference-data/channel/items/${itemId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    const publicRes = await request(app).get('/api/reference-data/channel/items');
    expect(publicRes.body.data.some((item) => item.code === 'temp_channel')).toBe(false);
  });

  it('يرفض إنشاء شكوى بتصنيف غير موجود ضمن reference_list_items', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .field('type', 'complaint')
      .field('governorateId', '1')
      .field('districtId', '2')
      .field('category', 'not_a_real_category')
      .field('description', 'نص وصف كافٍ لاختبار رفض تصنيف غير موجود فعلياً')
      .field('consentGiven', 'true');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
