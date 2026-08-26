import axiosClient from './axiosClient';

/**
 * User Administration API layer.
 *
 * Backend contract:
 *
 *   GET    /users                    list users (users.view)
 *   GET    /users/:userId            user detail (users.view)
 *   PUT    /users/:userId            update user (users.manage)
 *   PATCH  /users/:userId/deactivate deactivate user (users.manage)
 *   PATCH  /users/:userId/activate   activate user (users.manage)
 *   POST   /auth/register            create a user in the active org (users.manage)
 *   GET    /users/:userId/roles      list a user's role assignments (users.view)
 *   POST   /users/:userId/roles      assign a role (users.manage)
 *   DELETE /users/roles/:userRoleId  revoke a role (users.manage)
 *   GET    /users/:userId/groups     list a user's group memberships (users.view)
 *   POST   /users/:userId/groups     add a user to a group (users.manage)
 *   DELETE /users/groups/:userGroupId remove a user from a group (users.manage)
 *
 * The tenant context is resolved by the backend from the JWT and the
 * X-Organization-Id header — the frontend never sends an organization
 * identifier in the request body to establish tenant scope.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PrimaryOrganizationNode {
  id: number;
  legalName: string;
  shortName: string | null;
  code: string | null;
  isActive: boolean;
}

/** Full user record returned by GET /users and GET /users/:userId */
export interface ManagedUser {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  orgUnitId: number | null;
  defaultOrganizationId: number | null;
  primaryOrganizationNodeId: number | null;
  primaryOrganizationNode: PrimaryOrganizationNode | null;
}

export interface RegisterUserInput {
  fullName: string;
  email: string;
  password: string;
  /** Optional initial role code; the backend defaults to `staff` when omitted. */
  roleCode?: string;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string;
  primaryOrganizationNodeId?: number | null;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: 'true' | 'false';
}

export interface UserListResponse {
  data: ManagedUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UserRoleAssignment {
  id: number;
  userId: number;
  roleId: number;
  organizationId: number;
  orgUnitId: number | null;
  createdAt: string;
  updatedAt: string;
  role: { id: number; code: string; nameAr: string; nameEn: string | null };
  orgUnit: { id: number; name: string; code: string } | null;
}

export interface UserGroupAssignment {
  id: number;
  userId: number;
  groupId: number;
  organizationId: number;
  createdAt: string;
  updatedAt: string;
  group: { id: number; code: string; nameAr: string; nameEn: string | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const unwrap = async <T>(request: Promise<{ data: { success: boolean; data: T } }>): Promise<T> =>
  (await request).data.data;

// ── User List & Detail ────────────────────────────────────────────────────────

/** Lists users in the authenticated organization context. */
export const fetchUsers = async (params: UserListParams = {}): Promise<UserListResponse> => {
  const query: Record<string, string> = {};
  if (params.page !== undefined) query.page = String(params.page);
  if (params.limit !== undefined) query.limit = String(params.limit);
  if (params.search) query.search = params.search;
  if (params.isActive !== undefined) query.isActive = params.isActive;

  const res = await axiosClient.get<{ success: boolean; data: ManagedUser[]; pagination: UserListResponse['pagination'] }>('/users', { params: query });
  return { data: res.data.data, pagination: res.data.pagination };
};

/** Fetches a single user by ID within the authenticated organization. */
export const fetchUser = (userId: number): Promise<ManagedUser> =>
  unwrap<ManagedUser>(axiosClient.get(`/users/${userId}`));

// ── User Mutations ────────────────────────────────────────────────────────────

/** Creates a user in the authenticated organization context and assigns an initial role. */
export const registerUser = (input: RegisterUserInput): Promise<ManagedUser> =>
  unwrap<ManagedUser>(axiosClient.post('/auth/register', input));

/** Updates editable fields of a user within the authenticated organization. */
export const updateUser = (userId: number, input: UpdateUserInput): Promise<ManagedUser> =>
  unwrap<ManagedUser>(axiosClient.put(`/users/${userId}`, input));

/** Deactivates a user (soft disable) within the authenticated organization. */
export const deactivateUser = (userId: number): Promise<ManagedUser> =>
  unwrap<ManagedUser>(axiosClient.patch(`/users/${userId}/deactivate`));

/** Activates a previously deactivated user within the authenticated organization. */
export const activateUser = (userId: number): Promise<ManagedUser> =>
  unwrap<ManagedUser>(axiosClient.patch(`/users/${userId}/activate`));

// ── Roles ─────────────────────────────────────────────────────────────────────

/** Lists the role assignments of a user within the active organization. */
export const fetchUserRoles = (userId: number): Promise<UserRoleAssignment[]> =>
  unwrap<UserRoleAssignment[]>(axiosClient.get(`/users/${userId}/roles`));

/** Assigns an existing role (optionally scoped to an org node) to a user. */
export const assignUserRole = (
  userId: number,
  roleId: number,
  organizationNodeId?: number | null
): Promise<UserRoleAssignment> =>
  unwrap<UserRoleAssignment>(
    axiosClient.post(`/users/${userId}/roles`, { roleId, organizationNodeId: organizationNodeId ?? undefined })
  );

/** Revokes a user's role assignment. */
export const revokeUserRole = (userRoleId: number): Promise<void> =>
  axiosClient.delete(`/users/roles/${userRoleId}`).then(() => undefined);

// ── Groups ────────────────────────────────────────────────────────────────────

/** Lists a user's group memberships within the active organization. */
export const fetchUserGroups = (userId: number): Promise<UserGroupAssignment[]> =>
  unwrap<UserGroupAssignment[]>(axiosClient.get(`/users/${userId}/groups`));

/** Legacy compatibility endpoint; Group membership writes are frozen server-side. */
export const addUserToGroup = (userId: number, groupId: number): Promise<UserGroupAssignment> =>
  unwrap<UserGroupAssignment>(axiosClient.post(`/users/${userId}/groups`, { groupId }));

/** Legacy compatibility endpoint; Group membership writes are frozen server-side. */
export const removeUserFromGroup = (userGroupId: number): Promise<void> =>
  axiosClient.delete(`/users/groups/${userGroupId}`).then(() => undefined);
