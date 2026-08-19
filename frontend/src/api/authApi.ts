import axiosClient from './axiosClient';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  orgUnitId: number | null;
  defaultOrganizationId: number | null;
  roleCodes: string[];
  permissions?: { code: string; organizationId: number; orgUnitId: number | null }[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const res = await axiosClient.post<{ data: LoginResponse }>('/auth/login', { email, password });
  return res.data.data;
};

export const getMe = async (): Promise<AuthUser> => {
  const res = await axiosClient.get<{ data: AuthUser }>('/auth/me');
  return res.data.data;
};
