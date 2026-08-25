import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

export type LocationId = string | number;

export interface CountrySummary {
  id: number;
  nameEn: string;
  nameAr: string;
  iso2: string;
  iso3: string | null;
  isActive: boolean;
}

export interface GovernorateSummary {
  id: number;
  nameEn: string;
  nameAr: string;
  countryId?: number;
}

export interface DistrictSummary {
  id: number;
  nameEn: string;
  nameAr: string;
  governorateId: number;
}

export interface DistrictRecord extends DistrictSummary {
  isActive: boolean;
  createDate: Date;
  writeDate: Date;
  createUid: number | null;
  writeUid: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistrictWithGovernorate extends DistrictRecord {
  governorate: GovernorateSummary;
}

const GOVERNORATE_NOT_FOUND_MESSAGE =
  '\u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629\u0020\u063a\u064a\u0631\u0020\u0645\u0648\u062c\u0648\u062f\u0629';
const INVALID_LOCATION_PAIR_MESSAGE =
  '\u0627\u0644\u0645\u062f\u064a\u0631\u064a\u0629\u0020\u0627\u0644\u0645\u062d\u062f\u062f\u0629\u0020\u0644\u0627\u0020\u062a\u0646\u062a\u0645\u064a\u0020\u0625\u0644\u0649\u0020\u0627\u0644\u0645\u062d\u062f\u062f\u0629';

const toSafeInteger = (value: LocationId): number | null => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  if (!/^(0|[1-9]\d*)$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const mapGovernorate = (governorate: {
  id: number;
  name_en: string;
  name_ar: string;
  country_id?: number;
}): GovernorateSummary => ({
  id: governorate.id,
  nameEn: governorate.name_en,
  nameAr: governorate.name_ar,
  ...(governorate.country_id !== undefined ? { countryId: governorate.country_id } : {}),
});

const mapDistrict = (district: any): DistrictRecord => ({
  id: district.id,
  nameEn: district.name_en,
  nameAr: district.name_ar,
  governorateId: district.governorate_id,
  isActive: district.is_active,
  createDate: district.create_date,
  writeDate: district.write_date,
  createUid: district.create_uid ?? null,
  writeUid: district.write_uid ?? null,
  createdAt: district.create_date,
  updatedAt: district.write_date,
});

export const getAllCountries = async (): Promise<CountrySummary[]> => {
  const countries = await prisma.countries.findMany({
    where: { is_active: true },
    orderBy: { name_ar: 'asc' },
    select: {
      id: true,
      name_en: true,
      name_ar: true,
      iso2: true,
      iso3: true,
      is_active: true,
    },
  });

  return countries.map((c) => ({
    id: c.id,
    nameEn: c.name_en,
    nameAr: c.name_ar,
    iso2: c.iso2,
    iso3: c.iso3,
    isActive: c.is_active,
  }));
};

export const getAllGovernorates = async (countryId?: LocationId): Promise<GovernorateSummary[]> => {
  const whereClause: { is_active: boolean; country_id?: number } = { is_active: true };

  if (countryId !== undefined && countryId !== null && countryId !== '') {
    const parsedCountryId = toSafeInteger(countryId);
    if (parsedCountryId === null) {
      return [];
    }
    whereClause.country_id = parsedCountryId;
  }

  const governorates = await prisma.governorates.findMany({
    where: whereClause,
    orderBy: { name_ar: 'asc' },
    select: {
      id: true,
      name_en: true,
      name_ar: true,
      country_id: true,
    },
  });

  return governorates.map(mapGovernorate);
};

export const getDistrictsByGovernorate = async (
  governorateId: LocationId
): Promise<DistrictSummary[]> => {
  const parsedGovernorateId = toSafeInteger(governorateId);
  if (parsedGovernorateId === null) {
    throw new ApiError(404, GOVERNORATE_NOT_FOUND_MESSAGE);
  }

  const governorate = await prisma.governorates.findUnique({
    where: { id: parsedGovernorateId },
    select: { id: true },
  });
  if (!governorate) {
    throw new ApiError(404, GOVERNORATE_NOT_FOUND_MESSAGE);
  }

  const districts = await prisma.districts.findMany({
    where: {
      governorate_id: parsedGovernorateId,
      is_active: true,
    },
    orderBy: { name_ar: 'asc' },
    select: {
      id: true,
      name_en: true,
      name_ar: true,
      governorate_id: true,
    },
  });

  return districts.map((district) => ({
    id: district.id,
    nameEn: district.name_en,
    nameAr: district.name_ar,
    governorateId: district.governorate_id,
  }));
};

export const getAllDistricts = async (): Promise<DistrictWithGovernorate[]> => {
  const districts = await prisma.districts.findMany({
    where: { is_active: true },
    orderBy: { name_ar: 'asc' },
    select: {
      id: true,
      name_en: true,
      name_ar: true,
      governorate_id: true,
      is_active: true,
      create_date: true,
      write_date: true,
      create_uid: true,
      write_uid: true,
      governorates: {
        select: {
          id: true,
          name_en: true,
          name_ar: true,
        },
      },
    },
  });

  return districts.map((district) => ({
    ...mapDistrict(district),
    governorate: mapGovernorate(district.governorates),
  }));
};

export const validateGovernorateDistrictPair = async (
  governorateId: LocationId,
  districtId: LocationId
): Promise<DistrictRecord> => {
  const parsedGovernorateId = toSafeInteger(governorateId);
  const parsedDistrictId = toSafeInteger(districtId);

  if (parsedGovernorateId === null || parsedDistrictId === null) {
    throw new ApiError(422, INVALID_LOCATION_PAIR_MESSAGE);
  }

  const district = await prisma.districts.findFirst({
    where: {
      id: parsedDistrictId,
      governorate_id: parsedGovernorateId,
    },
    select: {
      id: true,
      name_en: true,
      name_ar: true,
      governorate_id: true,
      is_active: true,
      create_date: true,
      write_date: true,
      create_uid: true,
      write_uid: true,
    },
  });

  if (!district) {
    throw new ApiError(422, INVALID_LOCATION_PAIR_MESSAGE);
  }

  return mapDistrict(district);
};
