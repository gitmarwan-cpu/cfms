import type { AppRequest, AppResponse } from '../types/http';
import catchAsync from '../utils/catchAsync';
import * as locationService from '../services/locationService';
const getCountries = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await locationService.getAllCountries() }));
const getGovernorates = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await locationService.getAllGovernorates(req.query.countryId as string) }));
const getDistrictsByGovernorate = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await locationService.getDistrictsByGovernorate(req.params.governorateId) }));
const getAllDistricts = catchAsync(async (req: AppRequest, res: AppResponse) => res.status(200).json({ success: true, data: await locationService.getAllDistricts() }));

export { getCountries, getGovernorates, getDistrictsByGovernorate, getAllDistricts };
