import axiosClient from './axiosClient';

/**
 * تقديم شكوى/مقترح عبر البوابة العامة الخاصة بمؤسسة محددة. orgSlug إلزامي
 * دائماً - لا يُسمح بإرسال organizationId من الواجهة، المؤسسة تُحدَّد فقط
 * عبر الرابط (orgSlug) الذي يحلّه الخادم إلى معرّف داخلي.
 */
export const submitComplaint = async (orgSlug, formValues, files) => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لتقديم الشكوى');
  }

  const formData = new FormData();

  Object.entries(formValues).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, value);
  });

  files.forEach((file) => {
    formData.append('attachments', file);
  });

  const res = await axiosClient.post(`/public/${orgSlug}/complaints`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
};

/**
 * متابعة شكوى عبر الرقم المرجعي + رمز PIN الآمن، بلا تسجيل دخول.
 */
export const trackComplaint = async (orgSlug, referenceCode, pin) => {
  if (!orgSlug) {
    throw new Error('orgSlug مطلوب لمتابعة الشكوى');
  }
  const res = await axiosClient.post(`/public/${orgSlug}/complaints/track`, { referenceCode, pin });
  return res.data.data;
};
