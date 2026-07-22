'use strict';

const { OrgUnitType } = require('../models');
const ApiError = require('../utils/ApiError');

const listTypes = async (organizationId) => {
  return OrgUnitType.findAll({
    where: { organizationId },
    order: [['hierarchyLevel', 'ASC'], ['id', 'ASC']],
  });
};

const createType = async (organizationId, payload) => {
  const existing = await OrgUnitType.findOne({ where: { organizationId, code: payload.code } });
  if (existing) {
    throw new ApiError(409, 'الرمز (code) مستخدم بالفعل لنوع آخر ضمن هذه المؤسسة');
  }

  if (payload.allowedParentTypeId) {
    const parentType = await OrgUnitType.findOne({
      where: { id: payload.allowedParentTypeId, organizationId },
    });
    if (!parentType) {
      throw new ApiError(422, 'نوع الأصل المحدد غير موجود ضمن هذه المؤسسة');
    }
  }

  return OrgUnitType.create({
    organizationId,
    code: payload.code,
    nameAr: payload.nameAr,
    nameEn: payload.nameEn || null,
    hierarchyLevel: payload.hierarchyLevel || 1,
    allowedParentTypeId: payload.allowedParentTypeId || null,
    isActive: payload.isActive !== undefined ? payload.isActive : true,
  });
};

const updateType = async (organizationId, typeId, payload) => {
  const type = await OrgUnitType.findOne({ where: { id: typeId, organizationId } });
  if (!type) {
    throw new ApiError(404, 'نوع الوحدة التنظيمية غير موجود');
  }

  const fields = ['nameAr', 'nameEn', 'hierarchyLevel', 'allowedParentTypeId', 'isActive'];
  fields.forEach((field) => {
    if (payload[field] !== undefined) type[field] = payload[field];
  });

  await type.save();
  return type;
};

module.exports = { listTypes, createType, updateType };
