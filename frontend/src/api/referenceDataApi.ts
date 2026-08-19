import axiosClient from './axiosClient';

export interface ReferenceItem {
  id: number;
  referenceListId: number;
  code: string;
  labelAr: string;
  labelEn: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  meta: unknown;
  createdAt: string;
  updatedAt: string;
}

export const fetchReferenceItems = async (
  key: string,
  orgSlug: string | undefined
): Promise<ReferenceItem[]> => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لجلب البيانات المرجعية');
  }
  const res = await axiosClient.get<{ data: ReferenceItem[] }>(`/public/${orgSlug}/reference-data/${key}/items`);
  return res.data.data;
};
