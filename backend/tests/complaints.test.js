'use strict';

require('./setup');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prisma/client');
const { createUserWithRole, createOrganization } = require('./setup');

describe('Complaints API (Public Portal)', () => {
  let governorateId;
  let districtId;
  let otherGovernorateDistrictId;
  let organization;

  beforeAll(async () => {
    const ibb = await prisma.governorates.findUnique({ where: { name_en: 'Ibb' } });
    const district = await prisma.districts.findFirst({ where: { name_en: 'Yarim' } });
    const abyanDistrict = await prisma.districts.findFirst({ where: { name_en: 'Ahwar' } });

    organization = await prisma.organizations.create({
      data: {
        legal_name: 'مؤسسة اختبار الشكاوى',
        slug: 'test-org-complaints',
        country: 'Yemen',
        governorate_id: ibb.id,
        default_language: 'ar',
        timezone: 'Asia/Aden',
        date_format: 'DD/MM/YYYY',
        primary_color: '#0e5f66',
        secondary_color: '#0a464b',
        accent_color: '#c77b3f',
        anonymous_complaints_policy: 'allowed',
        notification_settings: {},
        is_active: true,
        create_date: new Date(),
        write_date: new Date(),
      },
    });

    governorateId = ibb.id;
    districtId = district.id;
    otherGovernorateDistrictId = abyanDistrict.id;
  });

  it('يرفض إنشاء شكوى بهوية مُفصَح عنها بدون رقم هاتف (القاعدة المطلوبة)', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'false')
      .field('fullName', 'مستخدم بلا هاتف')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار رفض عدم إدخال رقم الهاتف عند الإفصاح عن الهوية')
      .field('consentGiven', 'true');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('يقبل شكوى مجهولة تماماً بدون رقم هاتف (لا يجوز أن يصبح الهاتف إلزامياً عالمياً)', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'true')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار قبول شكوى مجهولة بلا رقم هاتف')
      .field('consentGiven', 'true');

    expect(res.status).toBe(201);
  });

  it('يقبل شكوى مع تحديد علاقة مقدّم الطلب بالمؤسسة (قيمة صحيحة من reference-data)', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'false')
      .field('fullName', 'مستفيد تجريبي')
      .field('phone', '777000222')
      .field('relationship', 'beneficiary')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار حقل علاقة مقدّم الطلب بالمؤسسة')
      .field('consentGiven', 'true');

    expect(res.status).toBe(201);
  });

  it('يرفض قيمة غير موجودة في قائمة complainant_relationship', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'true')
      .field('relationship', 'not_a_real_relationship')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار رفض قيمة علاقة غير صحيحة')
      .field('consentGiven', 'true');

    expect(res.status).toBe(422);
  });

  it('علاقة مقدّم الطلب بالمؤسسة تبقى اختيارية تماماً (لا تُطلَب أبداً)', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'true')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار بقاء حقل العلاقة اختيارياً بلا أي قيمة')
      .field('consentGiven', 'true');

    expect(res.status).toBe(201);
  });

  it('يقبل ويُخزّن مرجع المشروع وبيانات الموظف الحرة الاختيارية (بلا FK)', async () => {
    const res = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'true')
      .field('governorateId', String(governorateId))
      .field('districtId', String(districtId))
      .field('category', 'service_quality')
      .field('description', 'نص وصف كافٍ لاختبار حقول المشروع والموظف الاختيارية')
      .field('projectReferenceCode', 'مشروع الاستجابة الطارئة - إب')
      .field('isRelatedToStaff', 'true')
      .field('relatedStaffName', 'أحمد علي')
      .field('relatedStaffPosition', 'مسؤول توزيع')
      .field('staffIncidentDetails', 'تفاصيل تجريبية للواقعة')
      .field('consentGiven', 'true');

    expect(res.status).toBe(201);
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

describe('Complaint assignment API', () => {
  let organization;
  let adminToken;
  let unauthorizedToken;
  let complaintId;
  let assigneeUserId;
  let organizationNodeId;

  beforeAll(async () => {
    organization = await createOrganization({ legalName: 'مؤسسة اختبار التعيين', slug: `test-org-assignment-${Date.now()}` });

    const { user: adminUser } = await createUserWithRole(
      { fullName: 'مدير التعيين', email: `assignment.admin.${Date.now()}@cfms.local`, roleCode: 'admin', organizationId: organization.id },
      'Password123'
    );
    const { user: assigneeUser } = await createUserWithRole(
      { fullName: 'موظف التعيين', email: `assignment.staff.${Date.now()}@cfms.local`, roleCode: 'staff', organizationId: organization.id },
      'Password123'
    );
    const { user: unauthorizedUser } = await createUserWithRole(
      { fullName: 'مستخدم بلا صلاحية تعيين', email: `assignment.unauthorized.${Date.now()}@cfms.local`, roleCode: 'staff', organizationId: organization.id },
      'Password123'
    );
    assigneeUserId = assigneeUser.id;

    const adminLogin = await request(app).post('/api/auth/login').send({ email: adminUser.email, password: 'Password123' });
    adminToken = adminLogin.body.data.token;
    const unauthorizedLogin = await request(app).post('/api/auth/login').send({ email: unauthorizedUser.email, password: 'Password123' });
    unauthorizedToken = unauthorizedLogin.body.data.token;

    const typeResponse = await request(app)
      .post('/api/org-structure/unit-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `assignment_node_${Date.now()}`, nameAr: 'وحدة التعيين', hierarchyLevel: 1 });
    const nodeResponse = await request(app)
      .post('/api/organization/nodes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'وحدة معالجة الشكاوى', orgUnitTypeId: typeResponse.body.data.id });
    organizationNodeId = nodeResponse.body.data.id;

    const district = await prisma.districts.findFirst({ where: { governorate_id: organization.governorate_id } });
    const complaintResponse = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'true')
      .field('governorateId', String(organization.governorate_id))
      .field('districtId', String(district.id))
      .field('category', 'service_quality')
      .field('description', 'شكوى اختبارية لمسار التعيين الإداري')
      .field('consentGiven', 'true');
    complaintId = complaintResponse.body.data.id;
  });

  it('يعيد الانتقالات المسموحة فعلياً للحالة الحالية فقط', async () => {
    const response = await request(app)
      .get(`/api/complaints/${complaintId}/transitions`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.map((transition) => transition.toStatus)).toEqual(['in_review', 'rejected']);
    expect(response.body.data.every((transition) => transition.nameAr && transition.code)).toBe(true);
  });

  it('يرفض قراءة الانتقالات لمن لا يملك صلاحية تغيير الحالة', async () => {
    const response = await request(app)
      .get(`/api/complaints/${complaintId}/transitions`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(response.status).toBe(403);
  });

  it('يسمح للمستخدم المخول بتعيين الشكوى لمستخدم', async () => {
    const response = await request(app)
      .patch(`/api/complaints/${complaintId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeUserId, assigneeOrganizationId: null });

    expect(response.status).toBe(200);
    expect(response.body.data.assignedTo.id).toBe(assigneeUserId);
  });

  it('يسمح للمستخدم المخول بتعيين الشكوى لوحدة تنظيمية canonical', async () => {
    const response = await request(app)
      .patch(`/api/complaints/${complaintId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeUserId: null, assigneeOrganizationId: organizationNodeId });

    expect(response.status).toBe(200);
    expect(response.body.data.assignedToOrganization.id).toBe(organizationNodeId);
  });

  it('يرفض التعيين لمستخدم لا يملك صلاحية complaints.assign', async () => {
    const response = await request(app)
      .patch(`/api/complaints/${complaintId}/assignment`)
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .send({ assigneeUserId, assigneeOrganizationId: null });

    expect(response.status).toBe(403);
  });
});
