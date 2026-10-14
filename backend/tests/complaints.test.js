'use strict';

require('./setup');
const request = require('supertest');
const { default: app } = require('../src/app');
const { default: prisma } = require('../src/prisma/client');
const complaintService = require('../src/services/complaintService.ts');
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

  it('يرفض إعادة توليد رمز المتابعة لمستخدم لا يملك صلاحية complaints.assign', async () => {
    const response = await request(app)
      .post(`/api/complaints/${complaintId}/regenerate-pin`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(response.status).toBe(403);
  });

  it('يعيد توليد رمز المتابعة للمستخدم المخول ويحافظ على عقد القناة', async () => {
    await prisma.organizations.update({
      where: { id: organization.id },
      data: { notification_settings: { whatsapp: { enabled: true, provider: 'custom', sendPin: true } } },
    });
    const complaintResponse = await request(app)
      .post(`/api/public/${organization.slug}/complaints`)
      .field('type', 'complaint')
      .field('isAnonymous', 'false')
      .field('fullName', 'مستخدم إعادة التوليد')
      .field('phone', '777123999')
      .field('governorateId', String(organization.governorate_id))
      .field('districtId', String((await prisma.districts.findFirst({ where: { governorate_id: organization.governorate_id } })).id))
      .field('category', 'service_quality')
      .field('description', 'شكوى لاختبار إعادة توليد رمز المتابعة عبر المسار الإداري')
      .field('consentGiven', 'true');

    const response = await request(app)
      .post(`/api/complaints/${complaintResponse.body.data.id}/regenerate-pin`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ channel: 'custom' });
    expect(response.body.message).toContain('custom');
  });
});

describe("Complaint close authorization (complaints.close)", () => {
  let organization;
  let foreignOrganization;
  let district;
  let adminToken;
  let assignOnlyToken;
  let assignOnlyUserId;
  let assignAndCloseToken;
  let assignAndCloseUserId;
  let closeOnlyToken;
  let nonAssignToken;
  let assignOnlyRoleId;
  let assignAndCloseRoleId;
  let categoryItem;
  let channelItem;

  const loginToken = async (email) => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Password123" });
    expect(response.status).toBe(200);
    return response.body.data.token;
  };

  // Permissions are always resolved by code from the catalog (never by hard-coded ids).
  const permissionIdsByCode = async (codes) => {
    const permissions = await prisma.permissions.findMany({
      where: { code: { in: codes } },
    });
    expect(permissions.map((permission) => permission.code).sort()).toEqual(
      [...codes].sort(),
    );
    return permissions.map((permission) => permission.id);
  };

  const createCustomRole = async (code, permissionCodes) => {
    const permissionIds = await permissionIdsByCode(permissionCodes);
    const response = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code, nameAr: `دور اختبار ${code}`, permissionIds });
    expect(response.status).toBe(201);
    return response.body.data;
  };

  const createMemberWithCustomRole = async (label, roleId) => {
    const { user } = await createUserWithRole(
      {
        fullName: `مستخدم ${label}`,
        email: `close-guard.${label}.${Date.now()}@cfms.local`,
        roleCode: "staff",
        organizationId: organization.id,
      },
      "Password123",
    );
    // Keep the effective permission set exactly equal to the custom role under test.
    await prisma.user_roles.deleteMany({ where: { user_id: user.id } });
    await prisma.user_roles.create({
      data: {
        user_id: user.id,
        role_id: roleId,
        organization_id: organization.id,
        create_date: new Date(),
        write_date: new Date(),
      },
    });
    return { userId: user.id, token: await loginToken(user.email) };
  };

  // This suite verifies authorization, not submission: complaints are seeded directly so the
  // assertions stay deterministic and do not consume the public submission rate limit
  // (20 requests/hour per client), which is exercised by the public portal suite above.
  const createComplaint = async (targetOrganization = organization) => {
    const targetDistrict = targetOrganization.id === organization.id
      ? district
      : await prisma.districts.findFirst({
          where: { governorate_id: targetOrganization.governorate_id },
        });
    const complaint = await prisma.complaints.create({
      data: {
        organization_id: targetOrganization.id,
        type: "complaint",
        reference_code: `CG${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296)
          .toString(36)
          .toUpperCase()
          .padStart(2, "0")}`,
        is_anonymous: true,
        description: "شكوى اختبارية لتفويض الإغلاق",
        status: "new",
        consent_given: true,
        governorate_id: targetOrganization.governorate_id,
        district_id: targetDistrict.id,
        category_item_id: categoryItem.id,
        channel_item_id: channelItem.id,
        create_date: new Date(),
        write_date: new Date(),
      },
      select: { id: true },
    });
    return complaint.id;
  };

  const setStatus = (token, complaintId, status) =>
    request(app)
      .patch(`/api/complaints/${complaintId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status });

  const statusSnapshot = async (complaintId) => ({
    status: (
      await prisma.complaints.findUnique({
        where: { id: complaintId },
        select: { status: true },
      })
    ).status,
    history: await prisma.complaint_status_history.count({
      where: { complaint_id: complaintId },
    }),
    audits: await prisma.audit_logs.count({
      where: {
        entity_type: "complaint",
        entity_id: complaintId,
        action: "complaint.status_changed",
      },
    }),
    notifications: await prisma.notifications.count({
      where: { entity_id: complaintId },
    }),
  });

  beforeAll(async () => {
    organization = await createOrganization({
      legalName: "مؤسسة تفويض الإغلاق",
      slug: `close-guard-${Date.now()}`,
    });
    foreignOrganization = await createOrganization({
      legalName: "مؤسسة أخرى",
      slug: `close-guard-other-${Date.now()}`,
    });
    district = await prisma.districts.findFirst({
      where: { governorate_id: organization.governorate_id },
    });
    // Reference items reused when seeding complaints directly (see createComplaint below).
    categoryItem = await prisma.reference_list_items.findFirst({
      where: {
        is_active: true,
        code: "service_quality",
        reference_lists: { key: "complaint_category" },
      },
    });
    channelItem = await prisma.reference_list_items.findFirst({
      where: {
        is_active: true,
        code: "website",
        reference_lists: { key: "channel" },
      },
    });
    expect(categoryItem?.id).toBeTruthy();
    expect(channelItem?.id).toBeTruthy();

    const { user: adminUser } = await createUserWithRole(
      {
        fullName: "مدير تفويض الإغلاق",
        email: `close-guard.admin.${Date.now()}@cfms.local`,
        roleCode: "admin",
        organizationId: organization.id,
      },
      "Password123",
    );
    adminToken = await loginToken(adminUser.email);

    const suffix = Date.now();
    assignOnlyRoleId = (
      await createCustomRole(`close_guard_assign_${suffix}`, [
        "complaints.assign",
      ])
    ).id;
    assignAndCloseRoleId = (
      await createCustomRole(`close_guard_full_${suffix}`, [
        "complaints.assign",
        "complaints.close",
      ])
    ).id;
    const closeOnlyRoleId = (
      await createCustomRole(`close_guard_close_${suffix}`, [
        "complaints.close",
      ])
    ).id;

    const assignOnly = await createMemberWithCustomRole(
      "assign-only",
      assignOnlyRoleId,
    );
    assignOnlyToken = assignOnly.token;
    assignOnlyUserId = assignOnly.userId;

    const assignAndClose = await createMemberWithCustomRole(
      "assign-close",
      assignAndCloseRoleId,
    );
    assignAndCloseToken = assignAndClose.token;
    assignAndCloseUserId = assignAndClose.userId;

    closeOnlyToken = (
      await createMemberWithCustomRole("close-only", closeOnlyRoleId)
    ).token;

    const { user: plainStaff } = await createUserWithRole(
      {
        fullName: "مستخدم بلا صلاحيات",
        email: `close-guard.none.${Date.now()}@cfms.local`,
        roleCode: "staff",
        organizationId: organization.id,
      },
      "Password123",
    );
    nonAssignToken = await loginToken(plainStaff.email);
  });

  it("ينشئ مدير المؤسسة أدواراً مخصصة بالصلاحيات المطلوبة باستخدام رموز الصلاحيات", async () => {
    const assignOnlyRole = await request(app)
      .get(`/api/roles/${assignOnlyRoleId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(assignOnlyRole.status).toBe(200);
    expect(
      assignOnlyRole.body.data.permissions.map((permission) => permission.code),
    ).toEqual(["complaints.assign"]);

    const assignAndCloseRole = await request(app)
      .get(`/api/roles/${assignAndCloseRoleId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(assignAndCloseRole.status).toBe(200);
    expect(
      assignAndCloseRole.body.data.permissions
        .map((permission) => permission.code)
        .sort(),
    ).toEqual(["complaints.assign", "complaints.close"]);
  });

  it("يرفض الإغلاق لمن يملك complaints.assign فقط دون أي أثر جانبي", async () => {
    const complaintId = await createComplaint();
    await request(app)
      .patch(`/api/complaints/${complaintId}/assignment`)
      .set("Authorization", `Bearer ${assignOnlyToken}`)
      .send({ assigneeUserId: assignOnlyUserId, assigneeOrganizationId: null })
      .expect(200);

    expect(
      (await setStatus(assignOnlyToken, complaintId, "in_review")).status,
    ).toBe(200);
    expect(
      (await setStatus(assignOnlyToken, complaintId, "resolved")).status,
    ).toBe(200);

    const before = await statusSnapshot(complaintId);
    expect(before.status).toBe("resolved");

    const denied = await setStatus(assignOnlyToken, complaintId, "closed");
    expect(denied.status).toBe(403);
    expect(await statusSnapshot(complaintId)).toEqual(before);
  });

  it("يسمح بالإغلاق لمن يملك complaints.assign و complaints.close", async () => {
    const complaintId = await createComplaint();
    await request(app)
      .patch(`/api/complaints/${complaintId}/assignment`)
      .set("Authorization", `Bearer ${assignAndCloseToken}`)
      .send({
        assigneeUserId: assignAndCloseUserId,
        assigneeOrganizationId: null,
      })
      .expect(200);

    expect(
      (await setStatus(assignAndCloseToken, complaintId, "in_review")).status,
    ).toBe(200);
    expect(
      (await setStatus(assignAndCloseToken, complaintId, "resolved")).status,
    ).toBe(200);

    const closed = await setStatus(assignAndCloseToken, complaintId, "closed");
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe("closed");

    const history = await prisma.complaint_status_history.findMany({
      where: {
        complaint_id: complaintId,
        from_status: "resolved",
        to_status: "closed",
      },
    });
    expect(history).toHaveLength(1);
    expect(history[0].changed_by_user_id).toBe(assignAndCloseUserId);

    const audits = await prisma.audit_logs.findMany({
      where: {
        entity_type: "complaint",
        entity_id: complaintId,
        action: "complaint.status_changed",
      },
      orderBy: { id: "asc" },
    });
    expect(audits.filter((row) => row.metadata?.toStatus === "closed")).toEqual(
      [
        expect.objectContaining({
          actor_user_id: assignAndCloseUserId,
          metadata: { fromStatus: "resolved", toStatus: "closed" },
        }),
      ],
    );
  });

  it("يرفض تغيير الحالة لمن يملك complaints.close فقط (assign مطلوب)", async () => {
    const complaintId = await createComplaint();

    expect(
      (await setStatus(closeOnlyToken, complaintId, "closed")).status,
    ).toBe(403);
    expect(
      (await setStatus(closeOnlyToken, complaintId, "in_review")).status,
    ).toBe(403);

    const transitions = await request(app)
      .get(`/api/complaints/${complaintId}/transitions`)
      .set("Authorization", `Bearer ${closeOnlyToken}`);
    expect(transitions.status).toBe(403);

    const untouchedByCloseOnly = await prisma.complaints.findUnique({
      where: { id: complaintId },
      select: { status: true },
    });
    expect(untouchedByCloseOnly.status).toBe("new");
  });

  it("يرفض تغيير الحالة لمن لا يملك أي من الصلاحيتين", async () => {
    const complaintId = await createComplaint();

    expect(
      (await setStatus(nonAssignToken, complaintId, "closed")).status,
    ).toBe(403);
    expect(
      (await setStatus(nonAssignToken, complaintId, "in_review")).status,
    ).toBe(403);

    const untouchedByStaff = await prisma.complaints.findUnique({
      where: { id: complaintId },
      select: { status: true },
    });
    expect(untouchedByStaff.status).toBe("new");
  });

  it("يبقي الرفض (rejected) ضمن complaints.assign دون تغيير", async () => {
    const rejectedFromNew = await createComplaint();
    const directRejection = await setStatus(
      assignOnlyToken,
      rejectedFromNew,
      "rejected",
    );
    expect(directRejection.status).toBe(200);
    expect(directRejection.body.data.status).toBe("rejected");

    const rejectedFromReview = await createComplaint();
    expect(
      (await setStatus(assignOnlyToken, rejectedFromReview, "in_review"))
        .status,
    ).toBe(200);
    const reviewRejection = await setStatus(
      assignOnlyToken,
      rejectedFromReview,
      "rejected",
    );
    expect(reviewRejection.status).toBe(200);
    expect(reviewRejection.body.data.status).toBe("rejected");

    const rejectionAudits = await prisma.audit_logs.count({
      where: {
        entity_id: rejectedFromReview,
        action: "complaint.status_changed",
      },
    });
    expect(rejectionAudits).toBe(2);
  });

  it("يحافظ على 404 عند محاولة إغلاق شكوى مؤسسة أخرى بصلاحيتي assign و close", async () => {
    const foreignComplaintId = await createComplaint(foreignOrganization);

    const crossTenant = await setStatus(
      assignAndCloseToken,
      foreignComplaintId,
      "closed",
    );
    expect(crossTenant.status).toBe(404);

    const untouched = await prisma.complaints.findUnique({
      where: { id: foreignComplaintId },
      select: { status: true },
    });
    expect(untouched.status).toBe("new");
  });

  it("يحافظ على 409 للانتقال غير المعرّف لمن يملك الصلاحيتين", async () => {
    const complaintId = await createComplaint();

    const invalid = await setStatus(assignAndCloseToken, complaintId, "closed");
    expect(invalid.status).toBe(409);

    const stillNew = await prisma.complaints.findUnique({
      where: { id: complaintId },
      select: { status: true },
    });
    expect(stillNew.status).toBe("new");
  });

  it("يحافظ على دلالات سير العمل في قائمة الانتقالات (الترشيح مسؤولية الواجهة)", async () => {
    const complaintId = await createComplaint();
    expect(
      (await setStatus(assignOnlyToken, complaintId, "in_review")).status,
    ).toBe(200);
    expect(
      (await setStatus(assignOnlyToken, complaintId, "resolved")).status,
    ).toBe(200);

    const assignOnlyTransitions = await request(app)
      .get(`/api/complaints/${complaintId}/transitions`)
      .set("Authorization", `Bearer ${assignOnlyToken}`);
    expect(assignOnlyTransitions.status).toBe(200);
    expect(
      assignOnlyTransitions.body.data.map((transition) => transition.toStatus),
    ).toEqual(["closed"]);

    const assignAndCloseTransitions = await request(app)
      .get(`/api/complaints/${complaintId}/transitions`)
      .set("Authorization", `Bearer ${assignAndCloseToken}`);
    expect(assignAndCloseTransitions.status).toBe(200);
    expect(
      assignAndCloseTransitions.body.data.map(
        (transition) => transition.toStatus,
      ),
    ).toEqual(["closed"]);
  });

  describe("إلزامية ملاحظة الحل عند الانتقال إلى resolved (GAP-03)", () => {
    it("يرفض حل الشكوى إذا كانت الملاحظة مفقودة أو فارغة أو مسافات فقط (422)", async () => {
      const complaintId = await createComplaint();
      expect((await setStatus(assignOnlyToken, complaintId, "in_review")).status).toBe(200);

      // Missing note
      const missing = await request(app)
        .patch(`/api/complaints/${complaintId}/status`)
        .set("Authorization", `Bearer ${assignOnlyToken}`)
        .send({ status: "resolved" });
      expect(missing.status).toBe(422);

      // Empty string note
      const empty = await request(app)
        .patch(`/api/complaints/${complaintId}/status`)
        .set("Authorization", `Bearer ${assignOnlyToken}`)
        .send({ status: "resolved", note: "" });
      expect(empty.status).toBe(422);

      // Whitespace-only note
      const whitespace = await request(app)
        .patch(`/api/complaints/${complaintId}/status`)
        .set("Authorization", `Bearer ${assignOnlyToken}`)
        .send({ status: "resolved", note: "    " });
      expect(whitespace.status).toBe(422);
    });

    it("يقبل حل الشكوى عند تقديم ملاحظة حل غير فارغة (200)", async () => {
      const complaintId = await createComplaint();
      expect((await setStatus(assignOnlyToken, complaintId, "in_review")).status).toBe(200);

      const resolved = await request(app)
        .patch(`/api/complaints/${complaintId}/status`)
        .set("Authorization", `Bearer ${assignOnlyToken}`)
        .send({ status: "resolved", note: "تم إنجاز المعالجة وتسليم الخدمة" });
      expect(resolved.status).toBe(200);
      expect(resolved.body.data.status).toBe("resolved");

      const history = await prisma.complaint_status_history.findFirst({
        where: { complaint_id: complaintId, to_status: "resolved" },
        orderBy: { id: "desc" },
      });
      expect(history?.note).toBe("تم إنجاز المعالجة وتسليم الخدمة");
    });

    it("يفرض ملاحظة الحل وحدّ 1000 حرف عند استدعاء الخدمة مباشرة", async () => {
      const actorScope = {
        userId: assignOnlyUserId,
        tenantId: organization.id,
        grants: [{ code: "complaints.assign", orgUnitId: null }],
      };

      const blankComplaintId = await createComplaint();
      expect((await setStatus(assignOnlyToken, blankComplaintId, "in_review")).status).toBe(200);
      await expect(
        complaintService.updateComplaintStatus(
          organization.id,
          blankComplaintId,
          "resolved",
          "   ",
          assignOnlyUserId,
          actorScope,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });

      const oversizedComplaintId = await createComplaint();
      expect((await setStatus(assignOnlyToken, oversizedComplaintId, "in_review")).status).toBe(200);
      await expect(
        complaintService.updateComplaintStatus(
          organization.id,
          oversizedComplaintId,
          "resolved",
          "x".repeat(1001),
          assignOnlyUserId,
          actorScope,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it("يسمح بانتقالات الحالة الأخرى دون اشتراط الملاحظة", async () => {
      const complaintId = await createComplaint();
      const inReview = await request(app)
        .patch(`/api/complaints/${complaintId}/status`)
        .set("Authorization", `Bearer ${assignOnlyToken}`)
        .send({ status: "in_review" });
      expect(inReview.status).toBe(200);
    });
  });
});
