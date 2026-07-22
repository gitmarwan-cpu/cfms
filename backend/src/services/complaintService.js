'use strict';

const {
  Complaint,
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
const locationService = require('./locationService');
const referenceDataService = require('./referenceDataService');

const buildIncludes = () => [
  { model: Governorate, as: 'governorate', attributes: ['id', 'nameEn', 'nameAr'] },
  { model: District, as: 'district', attributes: ['id', 'nameEn', 'nameAr'] },
  { model: ComplaintAttachment, as: 'attachments' },
  { model: User, as: 'assignedTo', attributes: ['id', 'fullName', 'email'] },
  { model: ReferenceListItem, as: 'genderItem', attributes: ['id', 'code', 'labelAr', 'labelEn'] },
  { model: ReferenceListItem, as: 'ageGroupItem', attributes: ['id', 'code', 'labelAr', 'labelEn'] },
  { model: ReferenceListItem, as: 'categoryItem', attributes: ['id', 'code', 'labelAr', 'labelEn'] },
  { model: ReferenceListItem, as: 'channelItem', attributes: ['id', 'code', 'labelAr', 'labelEn'] },
];

/**
 * يعيد شكل استجابة متوافقاً مع الواجهة الحالية: يُبقي category/channel/gender/ageGroup
 * كحقول نصية مسطّحة (code) في مستوى الجذر للحفاظ على التوافق مع أي عميل حالي يعتمد
 * عليها، بينما يوفر أيضاً الكائن الكامل (id/code/labelAr/labelEn) عبر categoryItem
 * وغيره للواجهات الجديدة التي تحتاج تسميات قابلة للعرض ديناميكياً.
 */
const toPublicJSON = (complaint) => {
  const json = complaint.toJSON();
  return {
    ...json,
    gender: json.genderItem ? json.genderItem.code : null,
    ageGroup: json.ageGroupItem ? json.ageGroupItem.code : null,
    category: json.categoryItem ? json.categoryItem.code : null,
    channel: json.channelItem ? json.channelItem.code : null,
  };
};

const createComplaint = async (payload, files = []) => {
  return sequelize.transaction(async (t) => {
    await locationService.validateGovernorateDistrictPair(payload.governorateId, payload.districtId);

    const [genderItem, ageGroupItem, categoryItem, channelItem] = await Promise.all([
      payload.gender ? referenceDataService.resolveActiveItem('gender', payload.gender) : null,
      payload.ageGroup ? referenceDataService.resolveActiveItem('age_group', payload.ageGroup) : null,
      referenceDataService.resolveActiveItem('complaint_category', payload.category),
      referenceDataService.resolveActiveItem('channel', payload.channel || 'website'),
    ]);

    let referenceCode;
    // إعادة المحاولة في الحالة النادرة لتعارض الرقم المرجعي
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

    const complaint = await Complaint.create(
      {
        referenceCode,
        type: payload.type,
        isAnonymous: !!payload.isAnonymous,
        fullName: payload.isAnonymous ? null : payload.fullName,
        genderItemId: genderItem ? genderItem.id : null,
        ageGroupItemId: ageGroupItem ? ageGroupItem.id : null,
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
        changedByUserId: null,
      },
      { transaction: t }
    );

    const created = await Complaint.findByPk(complaint.id, { include: buildIncludes(), transaction: t });
    return toPublicJSON(created);
  });
};

const listComplaints = async (filters) => {
  const page = parseInt(filters.page, 10) || 1;
  const limit = parseInt(filters.limit, 10) || 20;
  const offset = (page - 1) * limit;

  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.governorateId) where.governorateId = filters.governorateId;
  if (filters.districtId) where.districtId = filters.districtId;
  if (filters.category) {
    const categoryItem = await referenceDataService.resolveActiveItem('complaint_category', filters.category);
    where.categoryItemId = categoryItem.id;
  }
  if (filters.isSensitive !== undefined) where.isSensitive = filters.isSensitive === 'true' || filters.isSensitive === true;

  const { rows, count } = await Complaint.findAndCountAll({
    where,
    include: buildIncludes(),
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return {
    data: rows.map(toPublicJSON),
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

const getComplaintById = async (id) => {
  const complaint = await Complaint.findByPk(id, {
    include: [...buildIncludes(), { model: ComplaintStatusHistory, as: 'statusHistory' }],
  });
  if (!complaint) {
    throw new ApiError(404, 'الطلب غير موجود');
  }
  return toPublicJSON(complaint);
};

const updateComplaintStatus = async (id, newStatus, note, changedByUserId) => {
  return sequelize.transaction(async (t) => {
    const complaint = await Complaint.findByPk(id, { transaction: t });
    if (!complaint) {
      throw new ApiError(404, 'الطلب غير موجود');
    }

    const fromStatus = complaint.status;
    complaint.status = newStatus;
    await complaint.save({ transaction: t });

    await ComplaintStatusHistory.create(
      {
        complaintId: complaint.id,
        fromStatus,
        toStatus: newStatus,
        note: note || null,
        changedByUserId,
      },
      { transaction: t }
    );

    return getComplaintById(id);
  });
};

module.exports = {
  createComplaint,
  listComplaints,
  getComplaintById,
  updateComplaintStatus,
};
