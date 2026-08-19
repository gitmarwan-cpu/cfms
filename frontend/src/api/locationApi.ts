import axiosClient from './axiosClient';

export interface GovernorateSummary {
  id: number;
  nameEn: string;
  nameAr: string;
}

export interface DistrictSummary {
  id: number;
  nameEn: string;
  nameAr: string;
  governorateId: number;
}

export const fetchGovernorates = async (): Promise<GovernorateSummary[]> => {
  const res = await axiosClient.get<{ data: GovernorateSummary[] }>('/locations/governorates');
  return res.data.data;
};

export const fetchDistrictsByGovernorate = async (
  governorateId: string | number | undefined
): Promise<DistrictSummary[]> => {
  if (!governorateId) return [];
  const res = await axiosClient.get<{ data: DistrictSummary[] }>(`/locations/governorates/${governorateId}/districts`);
  return res.data.data;
};
