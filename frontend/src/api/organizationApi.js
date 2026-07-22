import axiosClient from './axiosClient';

/**
 * يجلب إعدادات المؤسسة العامة (الاسم، الشعار، الألوان...) من الخادم.
 * يُستخدم لتطبيق الهوية البصرية ديناميكياً بدلاً من تضمينها ثابتة في الكود/CSS.
 * هذا المسار عام (بدون مصادقة) لأن نموذج تقديم الشكوى نفسه عام.
 */
export const fetchOrganizationSettings = async () => {
  const res = await axiosClient.get('/organization');
  return res.data.data;
};
