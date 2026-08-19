import type { AppRequest, AppResponse } from '../types/http';
const catchAsync = require('../utils/catchAsync');
const locationService = require('../services/locationService');
export {};

const getGovernorates = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await locationService.getAllGovernorates() }));
const getDistrictsByGovernorate = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await locationService.getDistrictsByGovernorate(req.params.governorateId) }));
const getAllDistricts = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await locationService.getAllDistricts() }));

module.exports = { getGovernorates, getDistrictsByGovernorate, getAllDistricts };
