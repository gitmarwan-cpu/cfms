import axiosClient from './axiosClient';

export interface PlatformUserListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: 'true' | 'false';
}

export interface PlatformUser {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  createDate: string | null;
  writeDate: string | null;
  createUid: number | null;
  writeUid: number | null;
  defaultOrganizationId: number | null;
  primaryOrganizationNodeId: number | null;
}

export interface PlatformUserListItem extends PlatformUser {
  membershipCount: number;
  activeMembershipCount: number;
}

export interface PlatformUserListResponse {
  data: PlatformUserListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface MembershipUserOption {
  id: number;
  fullName: string;
  email: string;
}

export interface MembershipUserOptionsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface MembershipUserOptionsResponse {
  data: MembershipUserOption[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PlatformRoleSummary {
  roleId: number;
  role: {
    code: string;
    nameAr: string | null;
    nameEn: string | null;
    scope: string;
  };
}

export interface PlatformUserDetails extends PlatformUser {
  memberships: Array<{
    id: number;
    organizationId: number;
    isPrimary: boolean;
    isActive: boolean;
    organization: {
      id: number;
      legal_name: string;
      slug: string;
      lifecycle_status: string;
    };
  }>;
  tenantRoles: Array<{
    id: number;
    roleId: number;
    organizationId: number;
    organizationNodeId: number | null;
    role: {
      code: string;
      nameAr: string | null;
      nameEn: string | null;
      scope: string;
    };
  }>;
  platformRoles: PlatformRoleSummary[];
}

export interface CreatePlatformUserInput {
  fullName: string;
  email: string;
  password: string;
}

export interface TenantProvisioningInput {
  legalName: string;
  slug: string;
  shortName: string | null;
  description: string | null;
  countryId: number | null;
  governorateId: number | null;
  districtId: number | null;
  email: string | null;
  website: string | null;
  initialAdmin: {
    fullName: string;
    email: string;
    password: string;
  };
}

export interface ProvisionedTenant {
  organization: {
    id: number;
    legalName: string;
    slug: string;
    lifecycleStatus: string;
    statusChangedAt: string | null;
    statusChangedByUserId: number | null;
    statusReason: string | null;
  };
  rootOrganizationNode: {
    id: number;
    parentId: number | null;
    rootOrganizationId: number | null;
    orgUnitTypeId: number | null;
  };
  initialAdmin: {
    id: number;
    fullName: string;
    email: string;
    isActive: boolean;
  };
  membership: {
    id: number;
    userId: number;
    organizationId: number;
    isPrimary: boolean;
    isActive: boolean;
  };
  tenantRole: {
    id: number;
    code: string;
    scope: string;
    organizationId: number | null;
    assignmentId: number;
  };
}

export type PlatformTenantLifecycleStatus =
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'deactivated'
  | 'archived';

export interface PlatformTenantListParams {
  page?: number;
  limit?: number;
  search?: string;
  lifecycleStatus?: PlatformTenantLifecycleStatus;
}

export interface PlatformTenantDirectoryItem {
  id: number;
  legalName: string;
  shortName: string | null;
  slug: string;
  countryId: number | null;
  governorateId: number | null;
  districtId: number | null;
  isActive: boolean;
  lifecycleStatus: PlatformTenantLifecycleStatus;
  statusChangedAt: string | null;
  statusReason: string | null;
  createdAt: string | null;
}

export interface PlatformTenantDetails extends PlatformTenantDirectoryItem {
  description: string | null;
  email: string | null;
  website: string | null;
  writeDate: string | null;
  statusChangedByUserId: number | null;
  deletedAt: string | null;
  parentId: number | null;
  rootOrganizationId: number | null;
  orgUnitTypeId: number | null;
}

export interface PlatformTenantLifecycleResult {
  tenantId: number;
  lifecycleStatus: PlatformTenantLifecycleStatus;
  statusChangedAt: string | null;
  statusChangedByUserId: number | null;
  statusReason: string | null;
}

export interface PlatformTenantListResponse {
  data: PlatformTenantDirectoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PlatformTenantMembershipRoleAssignment {
  id: number;
  roleId: number;
  organizationNodeId: number | null;
  role: {
    id: number;
    code: string;
    nameAr: string | null;
    nameEn: string | null;
    scope: 'tenant';
    organizationId: number | null;
  };
  organizationNode: {
    id: number;
    legalName: string;
    shortName: string | null;
    code: string | null;
  } | null;
}

export interface PlatformTenantMembership {
  id: number;
  userId: number;
  organizationId: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    isActive: boolean;
  };
  tenantRoles: PlatformTenantMembershipRoleAssignment[];
}

export interface PlatformTenantMembershipListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PlatformTenantMembershipListResponse {
  data: PlatformTenantMembership[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PlatformTenantRole {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  organizationId: number | null;
  isSystem: boolean;
  isActive: boolean;
  scope: 'tenant';
}

export interface PlatformTenantOrganizationNode {
  id: number;
  name: string;
  shortName: string | null;
  code: string | null;
  parentId: number | null;
  rootOrganizationId: number | null;
  orgUnitTypeId: number | null;
  isActive: boolean;
  unitType: {
    id: number;
    code: string;
    nameAr: string;
    nameEn: string | null;
    hierarchyLevel: number;
  } | null;
}

export interface PlatformMembershipMutation {
  id: number;
  userId: number;
  organizationId: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: number;
    legalName: string;
    shortName: string | null;
  } | null;
}

export interface PlatformTenantRoleAssignment {
  id: number;
  userId: number;
  roleId: number;
  organizationId: number;
  organizationNodeId: number | null;
  createDate: string | null;
  writeDate: string | null;
  createUid: number | null;
  writeUid: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  role: {
    id: number;
    code: string;
    nameAr: string | null;
    nameEn: string | null;
  };
  organizationNode: {
    id: number;
    legalName: string;
    shortName: string | null;
    code: string | null;
  } | null;
}

export interface PlatformTenantRoleInput {
  roleId: number;
  organizationNodeId?: number | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  pagination?: PlatformTenantListResponse['pagination'];
}

const unwrap = async <T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> => (await request).data.data;

export const fetchPlatformUsers = async (params: PlatformUserListParams = {}): Promise<PlatformUserListResponse> => {
  const query: Record<string, string> = {};
  if (params.page !== undefined) query.page = String(params.page);
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.isActive !== undefined) query.isActive = params.isActive;

  const response = await axiosClient.get<ApiEnvelope<PlatformUserListItem[]>>('/platform/users', { params: query });
  return {
    data: response.data.data,
    pagination: response.data.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 },
  };
};

export const fetchMembershipUserOptions = async (
  params: MembershipUserOptionsParams = {}
): Promise<MembershipUserOptionsResponse> => {
  const query: Record<string, string> = {};
  if (params.page !== undefined) query.page = String(params.page);
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.search) query.search = params.search;

  const response = await axiosClient.get<ApiEnvelope<MembershipUserOption[]>>('/platform/membership-user-options', { params: query });
  return {
    data: response.data.data,
    pagination: response.data.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 },
  };
};

export const fetchPlatformUser = (userId: number): Promise<PlatformUserDetails> =>
  unwrap<PlatformUserDetails>(axiosClient.get(`/platform/users/${userId}`));

export const createPlatformUser = (input: CreatePlatformUserInput): Promise<PlatformUser> =>
  unwrap<PlatformUser>(axiosClient.post('/platform/users', input));

export const activatePlatformUser = (userId: number): Promise<PlatformUser> =>
  unwrap<PlatformUser>(axiosClient.patch(`/platform/users/${userId}/activate`));

export const deactivatePlatformUser = (userId: number): Promise<PlatformUser> =>
  unwrap<PlatformUser>(axiosClient.patch(`/platform/users/${userId}/deactivate`));

export const provisionTenant = (input: TenantProvisioningInput): Promise<ProvisionedTenant> =>
  unwrap<ProvisionedTenant>(axiosClient.post('/platform/tenants', input));

export const fetchPlatformTenants = async (
  params: PlatformTenantListParams = {}
): Promise<PlatformTenantListResponse> => {
  const query: Record<string, string> = {};
  if (params.page !== undefined) query.page = String(params.page);
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.lifecycleStatus) query.lifecycleStatus = params.lifecycleStatus;

  const response = await axiosClient.get<ApiEnvelope<PlatformTenantDirectoryItem[]>>('/platform/tenants', { params: query });
  return {
    data: response.data.data,
    pagination: response.data.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 },
  };
};

export const fetchPlatformTenant = (organizationId: number): Promise<PlatformTenantDetails> =>
  unwrap<PlatformTenantDetails>(axiosClient.get(`/platform/tenants/${organizationId}`));

const transitionPlatformTenant = (
  organizationId: number,
  transition: 'suspend' | 'reactivate' | 'deactivate' | 'archive',
  reason?: string
): Promise<PlatformTenantLifecycleResult> =>
  unwrap<PlatformTenantLifecycleResult>(
    axiosClient.patch(
      `/platform/tenants/${organizationId}/${transition}`,
      reason?.trim() ? { reason: reason.trim() } : {}
    )
  );

export const suspendPlatformTenant = (organizationId: number, reason?: string) =>
  transitionPlatformTenant(organizationId, 'suspend', reason);

export const reactivatePlatformTenant = (organizationId: number, reason?: string) =>
  transitionPlatformTenant(organizationId, 'reactivate', reason);

export const deactivatePlatformTenant = (organizationId: number, reason?: string) =>
  transitionPlatformTenant(organizationId, 'deactivate', reason);

export const archivePlatformTenant = (organizationId: number, reason?: string) =>
  transitionPlatformTenant(organizationId, 'archive', reason);

export const fetchPlatformTenantMemberships = async (
  organizationId: number,
  params: PlatformTenantMembershipListParams = {}
): Promise<PlatformTenantMembershipListResponse> => {
  const query: Record<string, string> = {};
  if (params.page !== undefined) query.page = String(params.page);
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.search) query.search = params.search;

  const response = await axiosClient.get<ApiEnvelope<PlatformTenantMembership[]>>(
    `/platform/tenants/${organizationId}/memberships`,
    { params: query }
  );
  return {
    data: response.data.data,
    pagination: response.data.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 0 },
  };
};

export const fetchPlatformTenantRoles = (organizationId: number): Promise<PlatformTenantRole[]> =>
  unwrap<PlatformTenantRole[]>(axiosClient.get(`/platform/tenants/${organizationId}/roles`));

export const fetchPlatformTenantOrganizationNodes = (
  organizationId: number
): Promise<PlatformTenantOrganizationNode[]> =>
  unwrap<PlatformTenantOrganizationNode[]>(axiosClient.get(`/platform/tenants/${organizationId}/organization-nodes`));

export const addPlatformTenantMembership = (
  organizationId: number,
  userId: number
): Promise<PlatformMembershipMutation> =>
  unwrap<PlatformMembershipMutation>(axiosClient.post(`/platform/tenants/${organizationId}/users/${userId}/membership`, {}));

export const deactivatePlatformTenantMembership = (
  organizationId: number,
  userId: number
): Promise<PlatformMembershipMutation> =>
  unwrap<PlatformMembershipMutation>(axiosClient.delete(`/platform/tenants/${organizationId}/users/${userId}/membership`));

export const setPlatformTenantPrimaryMembership = (
  organizationId: number,
  userId: number
): Promise<PlatformMembershipMutation> =>
  unwrap<PlatformMembershipMutation>(axiosClient.patch(`/platform/tenants/${organizationId}/users/${userId}/membership/primary`));

export const assignPlatformTenantRole = (
  organizationId: number,
  userId: number,
  input: PlatformTenantRoleInput
): Promise<PlatformTenantRoleAssignment> =>
  unwrap<PlatformTenantRoleAssignment>(axiosClient.post(`/platform/tenants/${organizationId}/users/${userId}/roles`, input));

export const changePlatformTenantRole = (
  organizationId: number,
  userId: number,
  userRoleId: number,
  input: PlatformTenantRoleInput
): Promise<PlatformTenantRoleAssignment> =>
  unwrap<PlatformTenantRoleAssignment>(axiosClient.patch(`/platform/tenants/${organizationId}/users/${userId}/roles/${userRoleId}`, input));
