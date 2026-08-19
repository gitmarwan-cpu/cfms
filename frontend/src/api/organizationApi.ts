import axiosClient from './axiosClient';

export interface PublicOrganizationSettings {
  id: number;
  legalName: string;
  shortName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  defaultLanguage: string;
}

export const fetchOrganizationSettings = async (
  orgSlug: string | undefined
): Promise<PublicOrganizationSettings> => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لجلب إعدادات المؤسسة');
  }
  const res = await axiosClient.get<{ data: PublicOrganizationSettings }>(`/public/${orgSlug}/organization`);
  return res.data.data;
};
