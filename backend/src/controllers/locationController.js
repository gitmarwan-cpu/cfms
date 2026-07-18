'use strict';

const catchAsync = require('../utils/catchAsync');
const locationService = require('../services/locationService');

const getGovernorates = catchAsync(async (req, res) => {
  const governorates = await locationService.getAllGovernorates();
  res.status(200).json({ success: true, data: governorates });
});

const getDistrictsByGovernorate = catchAsync(async (req, res) => {
  const { governorateId } = req.params;
  const districts = await locationService.getDistrictsByGovernorate(governorateId);
  res.status(200).json({ success: true, data: districts });
});

const getAllDistricts = catchAsync(async (req, res) => {
  const districts = await locationService.getAllDistricts();
  res.status(200).json({ success: true, data: districts });
});

module.exports = { getGovernorates, getDistrictsByGovernorate, getAllDistricts };
