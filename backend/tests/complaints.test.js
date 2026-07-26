'use strict';

const { createOrganization, getDefaultOrg } = require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { Governorate, District } = require('../src/models');

describe('Complaints API (Public Portal)', () => {
  let governorateId;
  let districtId;
  let otherGovernorateDistrictId;
  let organization;

  beforeAll(async () => {
    organization = await createOrganization({ legalName: 'مؤسسة اختبار الشكاوى', slug: 'test-org-complaints' });

    const ibb = await Governorate.findOne({ where: { nameEn: 'Ibb' } });
    const district = await District.findOne({ where: { nameEn: 'Yarim' } });
    const abyanDistrict = await District.findOne({ where: { nameEn: 'Ahwar' } });

    governorateId = ibb.id;
    districtId = district.id;
    otherGovernorateDistrictId = abyanDistrict.id;
  });

  it('ينشئ شكوى جديدة بنجاح عند إرسال بيانات صحيحة، ويُعيد رقماً مرجعياً + PIN متابعة', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'false')
      .field('fullName', 'أحمد محمد')
      .field('phone', '777123456')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'هذا نص تجريبي لوصف الشكوى يجب أن يكون طويلاً بما فيه الكفاية')
      .field('consentGiven', 'true');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.referenceCode).toMatch(/^CFMS-\d{4}-\d{6}$/);
    expect(res.body.data.trackingPin).toMatch(/^\d{6}$/);
  });

  it('يرفض إنشاء شكوى بدون موافقة على معالجة البيانات (consentGiven)', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار الرفض بدون موافقة')
      .field('consentGiven', 'false');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('يرفض إنشاء شكوى إذا كانت المديرية لا تنتمي للمحافظة المحددة', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('governorateId', String(governorateId))
      .field('districtId', String(otherGovernorateDistrictId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار عدم تطابق المحافظة والمديرية')
      .field('consentGiven', 'true');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('يرفض تقديم شكوى لمؤسسة بـ slug غير موجود', async () => {
    const res = await request(app)
      .post('/api/public/not-a-real-organization/complaints')
      .field('type', 'complaint')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار مؤسسة غير موجودة')
      .field('consentGiven', 'true');

    expect(res.status).toBe(404);
  });

  it('يمنع الوصول لقائمة الشكاوى الإدارية بدون تسجيل دخول', async () => {
    const res = await request(app).get('/api/complaints');
    expect(res.status).toBe(401);
  });

  it('يتيح متابعة الشكوى عبر الرقم المرجعي + PIN الصحيحين فقط', async () => {
    const createRes = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'true')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'شكوى مجهولة لاختبار خاصية المتابعة عبر الرقم المرجعي والـ PIN')
      .field('consentGiven', 'true');

    const { referenceCode, trackingPin } = createRes.body.data;

    const wrongPinRes = await request(app)
      .post(`/api/public/${organization.slug}/complaints/track`)
      .send({ referenceCode, pin: '000000' });
    expect(wrongPinRes.status).toBe(404);

    const okRes = await request(app)
      .post(`/api/public/${organization.slug}/complaints/track`)
      .send({ referenceCode, pin: trackingPin });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.status).toBe('new');
    expect(okRes.body.data).not.toHaveProperty('assignedTo');
  });
});
