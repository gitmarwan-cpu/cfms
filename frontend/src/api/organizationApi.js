import axiosClient from './axiosClient';

/**
 * يجلب إعدادات المؤسسة العامة (الاسم، الشعار، الألوان...) من الخادم عبر
 * البوابة العامة متعددة المؤسسات (Multi-Tenant Public Portal). orgSlug
 * إلزامي دائماً - لا يوجد مسار "افتراضي" بلا مؤسسة محددة، لأن كل مؤسسة
 * لها إعداداتها وهويتها البصرية الخاصة.
 */
export const fetchOrganizationSettings = async (orgSlug) => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لجلب إعدادات المؤسسة');
  }
  const res = await axiosClient.get(`/public/${orgSlug}/organization`);
  return res.data.data;
};
