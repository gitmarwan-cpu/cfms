import axios, { type AxiosError, type AxiosInstance } from 'axios';

export interface ApiErrorDetail {
  field?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  message?: string;
  details?: ApiErrorDetail[];
}

export interface ApiClientError {
  message: string;
  details: ApiErrorDetail[];
  status?: number;
}

const axiosClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

/**
 * Session-scoped key holding the currently selected organization id. Written
 * only by AuthContext after validating the id against /auth/me memberships;
 * read by the request interceptor below. Never trust it for authorization —
 * the backend validates the header against active memberships server-side.
 */
export const ORGANIZATION_STORAGE_KEY = 'cfms_org_id';

/** Requests that are context-free by design: authentication + orgSlug-scoped public portal. */
const NON_TENANT_PATH_MARKERS = ['/auth/', '/public/'];

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cfms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Tenant context: tenant-scoped APIs always carry the selected organization.
  // The header is set unconditionally (overwriting any caller-supplied value)
  // so no API module can inject an unrelated organization id. The backend
  // remains authoritative: it validates the header against active memberships
  // and ignores it entirely for /auth/* and /public/:orgSlug/* routes.
  const url = config.url ?? '';
  const isTenantScoped = !NON_TENANT_PATH_MARKERS.some((marker) => url.includes(marker));
  if (isTenantScoped) {
    const organizationId = sessionStorage.getItem(ORGANIZATION_STORAGE_KEY);
    if (organizationId) {
      config.headers['X-Organization-Id'] = organizationId;
    }
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('cfms_unauthorized'));
    }
    const message =
      error.response?.data?.message || 'حدث خطأ في الاتصال بالخادم، الرجاء المحاولة لاحقاً';
    const details = error.response?.data?.details || [];
    return Promise.reject({ message, details, status: error.response?.status } satisfies ApiClientError);
  }
);

export default axiosClient;
