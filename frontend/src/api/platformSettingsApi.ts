import axiosClient from './axiosClient';

export interface EmailSettings {
  source: 'database' | 'environment' | 'none';
  status: 'active' | 'error' | 'unconfigured';
  errorDetail: 'decryption_failed' | 'database_unavailable' | 'migration_missing' | 'key_missing' | null;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  senderEmail: string;
  senderName: string;
  hasPassword: boolean;
  updatedAt: string | null;
}

export interface UpdateEmailSettingsPayload {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  senderEmail: string;
  senderName?: string;
  password?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

const unwrap = async <T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> => (await request).data.data;

export const fetchEmailSettings = (): Promise<EmailSettings> =>
  unwrap<EmailSettings>(axiosClient.get('/platform/settings/email'));

export const updateEmailSettings = (payload: UpdateEmailSettingsPayload): Promise<EmailSettings> =>
  unwrap<EmailSettings>(axiosClient.put('/platform/settings/email', payload));

export const sendTestEmail = async (): Promise<{ message: string }> => {
  const response = await axiosClient.post<{ success: boolean; message: string }>('/platform/settings/email/test', {});
  return { message: response.data.message };
};
