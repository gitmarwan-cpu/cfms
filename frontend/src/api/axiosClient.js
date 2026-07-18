import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cfms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || 'حدث خطأ في الاتصال بالخادم، الرجاء المحاولة لاحقاً';
    const details = error.response?.data?.details || [];
    return Promise.reject({ message, details, status: error.response?.status });
  }
);

export default axiosClient;
