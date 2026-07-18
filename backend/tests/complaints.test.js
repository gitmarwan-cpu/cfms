'use strict';

require('./setup');
const request = require('supertest');
const app = require('../src/app');
const { Governorate, District } = require('../src/models');

describe('Complaints API', () => {
  let governorateId;
  let districtId;
  let otherGovernorateDistrictId;

  beforeAll(async () => {
    const ibb = await Governorate.findOne({ where: { nameEn: 'Ibb' } });
    const district = await District.findOne({ where: { nameEn: 'Yarim' } });
    const abyanDistrict = await District.findOne({ where: { nameEn: 'Ahwar' } });

    governorateId = ibb.id;
    districtId = district.id;
    otherGovernorateDistrictId = abyanDistrict.id;
  });

  it('ينشئ شكوى جديدة بنجاح عند إرسال بيانات صحيحة', async () => {
    const res = await request(app)
      .post('/api/complaints')
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
  });

  it('يرفض إنشاء شكوى بدون موافقة على معالجة البيانات (consentGiven)', async () => {
    const res = await request(app)
      .post('/api/complaints')
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
      .post('/api/complaints')
      .field('type', 'complaint')
      .field('governorateId', String(governorateId))
      .field('districtId', String(otherGovernorateDistrictId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار عدم تطابق المحافظة والمديرية')
      .field('consentGiven', 'true');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('يمنع الوصول لقائمة الشكاوى بدون تسجيل دخول', async () => {
    const res = await request(app).get('/api/complaints');
    expect(res.status).toBe(401);
  });
});
