import axiosClient from './axiosClient';

export const submitComplaint = async (formValues, files) => {
  const formData = new FormData();

  Object.entries(formValues).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, value);
  });

  files.forEach((file) => {
    formData.append('attachments', file);
  });

  const res = await axiosClient.post('/complaints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
};
