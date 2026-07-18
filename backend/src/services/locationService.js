'use strict';

const { Governorate, District } = require('../models');
const ApiError = require('../utils/ApiError');

const getAllGovernorates = async () => {
  return Governorate.findAll({
    where: { isActive: true },
    order: [['nameAr', 'ASC']],
    attributes: ['id', 'nameEn', 'nameAr'],
  });
};

const getDistrictsByGovernorate = async (governorateId) => {
  const governorate = await Governorate.findByPk(governorateId);
  if (!governorate) {
    throw new ApiError(404, 'المحافظة غير موجودة');
  }

  return District.findAll({
    where: { governorateId, isActive: true },
    order: [['nameAr', 'ASC']],
    attributes: ['id', 'nameEn', 'nameAr', 'governorateId'],
  });
};

const getAllDistricts = async () => {
  return District.findAll({
    where: { isActive: true },
    order: [['nameAr', 'ASC']],
    include: [{ model: Governorate, as: 'governorate', attributes: ['id', 'nameEn', 'nameAr'] }],
  });
};

const validateGovernorateDistrictPair = async (governorateId, districtId) => {
  const district = await District.findOne({
    where: { id: districtId, governorateId },
  });
  if (!district) {
    throw new ApiError(422, 'المديرية المحددة لا تنتمي إلى المحافظة المحددة');
  }
  return district;
};

module.exports = {
  getAllGovernorates,
  getDistrictsByGovernorate,
  getAllDistricts,
  validateGovernorateDistrictPair,
};
