'use strict';

const { Complaint, ComplaintAttachment, ComplaintStatusHistory, Governorate, District, User, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const generateReferenceCode = require('../utils/generateReferenceCode');
const locationService = require('./locationService');

const buildIncludes = () => [
  { model: Governorate, as: 'governorate', attributes: ['id', 'nameEn', 'nameAr'] },
  { model: District, as: 'district', attributes: ['id', 'nameEn', 'nameAr'] },
  { model: ComplaintAttachment, as: 'attachments' },
  { model: User, as: 'assignedTo', attributes: ['id', 'fullName', 'email'] },
];

const createComplaint = async (payload, files = []) => {
  return sequelize.transaction(async (t) => {
    await locationService.validateGovernorateDistrictPair(payload.governorateId, payload.districtId);

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
        gender: payload.gender || null,
        ageGroup: payload.ageGroup || null,
        phone: payload.isAnonymous ? null : payload.phone,
        email: payload.isAnonymous ? null : payload.email,
        governorateId: payload.governorateId,
        districtId: payload.districtId,
        village: payload.village || null,
        category: payload.category,
        isSensitive: !!payload.isSensitive,
        description: payload.description,
        desiredResolution: payload.desiredResolution || null,
        channel: payload.channel || 'website',
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

    return Complaint.findByPk(complaint.id, { include: buildIncludes(), transaction: t });
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
  if (filters.category) where.category = filters.category;
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
    data: rows,
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
  return complaint;
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
