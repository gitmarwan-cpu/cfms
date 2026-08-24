import axiosClient from './axiosClient';

export interface CountrySummary {
  id: number;
  nameEn: string;
  nameAr: string;
  iso2: string;
  iso3: string | null;
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

export const fetchCountries = async (): Promise<CountrySummary[]> => {
  const res = await axiosClient.get<{ data: CountrySummary[] }>('/locations/countries');
  return res.data.data;
};

export const fetchGovernorates = async (
  countryId?: string | number | undefined
): Promise<GovernorateSummary[]> => {
  const url = countryId ? `/locations/governorates?countryId=${countryId}` : '/locations/governorates';
  const res = await axiosClient.get<{ data: GovernorateSummary[] }>(url);
  return res.data.data;
};

export const fetchDistrictsByGovernorate = async (
  governorateId: string | number | undefined
): Promise<DistrictSummary[]> => {
  if (!governorateId) return [];
  const res = await axiosClient.get<{ data: DistrictSummary[] }>(`/locations/governorates/${governorateId}/districts`);
  return res.data.data;
};
