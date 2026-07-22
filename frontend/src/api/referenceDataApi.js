import axiosClient from './axiosClient';

/**
 * يجلب عناصر قائمة مرجعية معيّنة (مفعّلة فقط) من الخادم، بدلاً من الاعتماد
 * على مصفوفات ثابتة (constants) داخل الواجهة الأمامية.
 * key أمثلة: 'complaint_category' | 'channel' | 'gender' | 'age_group'
 */
export const fetchReferenceItems = async (key) => {
  const res = await axiosClient.get(`/reference-data/${key}/items`);
  return res.data.data;
};
