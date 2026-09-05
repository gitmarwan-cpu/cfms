import axiosClient from './axiosClient';

export interface MembershipOrganization {
  id: number;
  name: string;
  shortName: string | null;
  slug: string;
  isPrimary: boolean;
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  orgUnitId: number | null;
  defaultOrganizationId: number | null;
  roleCodes: string[];
  permissions?: { code: string; organizationId: number; orgUnitId: number | null }[];
  /** Active memberships (from /auth/me) — drives the organization switcher. */
  organizations?: MembershipOrganization[];
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

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** Self-service password change (POST /auth/change-password). */
export const changePassword = async (input: ChangePasswordInput): Promise<void> => {
  await axiosClient.post('/auth/change-password', input);
};
