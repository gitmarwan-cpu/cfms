import axiosClient from './axiosClient';

/**
 * يجلب عناصر قائمة مرجعية معيّنة (مفعّلة فقط) عبر البوابة العامة الخاصة
 * بمؤسسة محددة (Template + Override: قد تكون نسخة المؤسسة أو النظامية
 * الافتراضية، والخادم يحسم ذلك تلقائياً). orgSlug إلزامي دائماً.
 * key أمثلة: 'complaint_category' | 'channel' | 'gender' | 'age_group'
 */
export const fetchReferenceItems = async (key, orgSlug) => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لجلب البيانات المرجعية');
  }
  const res = await axiosClient.get(`/public/${orgSlug}/reference-data/${key}/items`);
  return res.data.data;
};
