import axiosClient from './axiosClient';

export const fetchGovernorates = async () => {
  const res = await axiosClient.get('/locations/governorates');
  return res.data.data;
};

export const fetchDistrictsByGovernorate = async (governorateId) => {
  if (!governorateId) return [];
  const res = await axiosClient.get(`/locations/governorates/${governorateId}/districts`);
  return res.data.data;
};
