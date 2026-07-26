'use strict';

const {
  Complaint,
  Complainant,
  ComplaintAttachment,
  ComplaintStatusHistory,
  Governorate,
  District,
  User,
  ReferenceListItem,
  sequelize,
} = require('../models');
const ApiError = require('../utils/ApiError');
const generateReferenceCode = require('../utils/generateReferenceCode');
const { generatePin, hashPin, verifyPin } = require('../utils/pin');
const { withTenantScope, assertBelongsToTenant } = require('../utils/tenantScope');
const locationService = require('./locationService');
const referenceDataService = require('./referenceDataService');

const buildIncludes = () => [
  { model: Complainant, as: 'complainant' },
  { model: Governorate, as: 'governorate', attributes: ['id', 'nameEn', 'nameAr'] },
  { model: District, as: 'district', attributes: ['id', 'nameEn', 'nameAr'] },
  { model: ComplaintAttachment, as: 'attachments' },
  { model: User, as: 'assignedTo', attributes: ['id', 'fullName', 'email'] },
  { model: ReferenceListItem, as: 'categoryItem', attributes: ['id', 'code', 'labelAr', 'labelEn'] },
  { model: ReferenceListItem, as: 'channelItem', attributes: ['id', 'code', 'labelAr', 'labelEn'] },
];

const toPublicJSON = (complaint) => {
  const json = complaint.toJSON();
  return {
    ...json,
    category: json.categoryItem ? json.categoryItem.code : null,
    channel: json.channelItem ? json.channelItem.code : null,
  };
};

/**
 * ============================================================
 * إنشاء شكوى/مقترح - المسار العام (بلا مصادقة) والمسار الإداري (موظف
 * يُدخل نيابة عن مستفيد) يستخدمان نفس الدالة.
 * ============================================================
 * organizationId: يأتي دائماً من سياق الخادم (resolvePublicTenant عبر
 * slug، أو resolveAuthenticatedTenant لموظف مسجّل دخوله) - لا يُقرأ أبداً
 * من body الطلب، حتى لو أرسله العميل، لمنع أي محاولة تحويل شكوى لمؤسسة
 * أخرى عبر التلاعب بالـ payload.
 * createdByUserId: null للمستفيد عبر البوابة العامة؛ قيمة لموظف يُدخلها.
 */
const createComplaint = async (organizationId, payload, files = [], createdByUserId = null) => {
  return sequelize.transaction(async (t) => {
    await locationService.validateGovernorateDistrictPair(payload.governorateId, payload.districtId);

    const [genderItem, ageGroupItem, categoryItem, channelItem] = await Promise.all([
      payload.gender ? referenceDataService.resolveActiveItem('gender', payload.gender, organizationId) : null,
      payload.ageGroup
        ? referenceDataService.resolveActiveItem('age_group', payload.ageGroup, organizationId)
        : null,
      referenceDataService.resolveActiveItem('complaint_category', payload.category, organizationId),
      referenceDataService.resolveActiveItem('channel', payload.channel || 'website', organizationId),
    ]);

    // فصل معماري: لا سجل Complainant إطلاقاً إن كانت الشكوى مجهولة بالكامل
    // بلا أي بيانات هوية؛ وإلا يُنشأ سجل جديد مستقل تماماً عن جدول users.
    let complainantId = null;
    const hasIdentityData = !payload.isAnonymous && (payload.fullName || payload.phone || payload.email);
    if (hasIdentityData) {
      const complainant = await Complainant.create(
        {
          organizationId,
          fullName: payload.fullName || null,
          phone: payload.phone || null,
          email: payload.email || null,
          genderItemId: genderItem ? genderItem.id : null,
          ageGroupItemId: ageGroupItem ? ageGroupItem.id : null,
          beneficiaryExternalId: payload.beneficiaryExternalId || null,
        },
        { transaction: t }
      );
      complainantId = complainant.id;
    }

    let referenceCode;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateReferenceCode();
      // eslint-disable-next-line no-await-in-loop
      const existing = await Complaint.findOne({ where: { referenceCode: candidate }, transaction: t });
      if (!existing) {
        referenceCode = candidate;
        break;
      }
    }
    if (!referenceCode) {
      throw new ApiError(500, 'تعذر توليد رقم مرجعي فريد، الرجاء المحاولة لاحقاً');
    }

    // PIN آمن لمتابعة الشكوى دون تسجيل دخول - يُعاد نصاً صريحاً مرة واحدة
    // فقط في استجابة هذه الدالة؛ المُخزَّن دائماً هو الـ hash فقط.
    const trackingPin = generatePin();
    const trackingPinHash = await hashPin(trackingPin);

    const complaint = await Complaint.create(
      {
        referenceCode,
        organizationId,
        complainantId,
        trackingPinHash,
        createdByUserId,
        type: payload.type,
        isAnonymous: !!payload.isAnonymous,
        phone: payload.isAnonymous ? null : payload.phone,
        email: payload.isAnonymous ? null : payload.email,
        governorateId: payload.governorateId,
        districtId: payload.districtId,
        village: payload.village || null,
        categoryItemId: categoryItem.id,
        isSensitive: !!payload.isSensitive || !!(categoryItem.meta && categoryItem.meta.forcesSensitive),
        description: payload.description,
        desiredResolution: payload.desiredResolution || null,
        channelItemId: channelItem.id,
        consentGiven: !!payload.consentGiven,
        status: 'new',
      },
      { transaction: t }
    );

    if (files && files.length > 0) {
      const attachmentRows = files.map((file) => ({
        complaintId: complaint.id,
        originalName: file.originalname,
        storedFileName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }));
      await ComplaintAttachment.bulkCreate(attachmentRows, { transaction: t });
    }

    await ComplaintStatusHistory.create(
      {
        complaintId: complaint.id,
        fromStatus: null,
        toStatus: 'new',
        note: 'تم إنشاء الطلب',
        changedByUserId: createdByUserId,
      },
      { transaction: t }
    );

    const created = await Complaint.findByPk(complaint.id, { include: buildIncludes(), transaction: t });
    return { complaint: toPublicJSON(created), trackingPin };
  });
};

/**
 * قائمة الشكاوى - إدارية فقط، مُصفّاة إلزامياً بـ organizationId (من
 * resolveAuthenticatedTenant)، وليس أي قيمة قد ترد في query params.
 */
const listComplaints = async (organizationId, filters) => {
  const page = parseInt(filters.page, 10) || 1;
  const limit = parseInt(filters.limit, 10) || 20;
  const offset = (page - 1) * limit;

  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.governorateId) where.governorateId = filters.governorateId;
  if (filters.districtId) where.districtId = filters.districtId;
  if (filters.category) {
    const categoryItem = await referenceDataService.resolveActiveItem(
      'complaint_category',
      filters.category,
      organizationId
    );
    where.categoryItemId = categoryItem.id;
  }
  if (filters.isSensitive !== undefined) where.isSensitive = filters.isSensitive === 'true' || filters.isSensitive === true;

  const { rows, count } = await Complaint.findAndCountAll(
    withTenantScope(organizationId, {
      where,
      include: buildIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    })
  );

  return {
    data: rows.map(toPublicJSON),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

const getComplaintById = async (organizationId, id) => {
  const complaint = await Complaint.findByPk(id, {
    include: [...buildIncludes(), { model: ComplaintStatusHistory, as: 'statusHistory' }],
  });
  assertBelongsToTenant(complaint, organizationId, 'الطلب غير موجود');
  return toPublicJSON(complaint);
};

const updateComplaintStatus = async (organizationId, id, newStatus, note, changedByUserId) => {
  return sequelize.transaction(async (t) => {
    const complaint = await Complaint.findByPk(id, { transaction: t });
    assertBelongsToTenant(complaint, organizationId, 'الطلب غير موجود');

    const fromStatus = complaint.status;
    complaint.status = newStatus;
    await complaint.save({ transaction: t });

    await ComplaintStatusHistory.create(
      { complaintId: complaint.id, fromStatus, toStatus: newStatus, note: note || null, changedByUserId },
      { transaction: t }
    );

    return getComplaintById(organizationId, id);
  });
};

/**
 * متابعة عامة (بلا تسجيل دخول) عبر رقم مرجعي + PIN. تُعيد فقط ما يُسمح
 * للمستفيد برؤيته (بند تاسعاً/السابع عشر في التوجيه المعماري): الحالة
 * المبسّطة، تاريخ الإرسال، آخر تحديث، الرد النهائي إن وُجد - بلا أي
 * تفاصيل داخلية (ملاحظات، إسناد، سجل إجراءات داخلي).
 */
const SIMPLIFIED_STATUS_MAP = {
  new: 'تم استلام الشكوى',
  in_review: 'قيد المراجعة',
  resolved: 'تم الحل',
  closed: 'أُغلقت',
  rejected: 'أُغلقت',
};

const trackComplaint = async (organizationId, referenceCode, pin) => {
  const complaint = await Complaint.findOne({ where: { organizationId, referenceCode } });
  if (!complaint || !complaint.trackingPinHash) {
    throw new ApiError(404, 'رقم مرجعي أو رمز متابعة غير صحيح');
  }

  const isValidPin = await verifyPin(pin, complaint.trackingPinHash);
  if (!isValidPin) {
    throw new ApiError(404, 'رقم مرجعي أو رمز متابعة غير صحيح');
  }

  return {
    referenceCode: complaint.referenceCode,
    status: complaint.status,
    statusLabel: SIMPLIFIED_STATUS_MAP[complaint.status] || complaint.status,
    submittedAt: complaint.createdAt,
    lastUpdatedAt: complaint.updatedAt,
  };
};

module.exports = {
  createComplaint,
  listComplaints,
  getComplaintById,
  updateComplaintStatus,
  trackComplaint,
};
