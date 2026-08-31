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
  /** Memberships of the user in the active organization context (when requested). */
  memberships?: Membership[];
  /** Derived from audit_logs by the backend — no dedicated column exists. */
  lastLoginAt?: string | null;
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

/** A tenant-membership row (user_organizations) as returned by the backend. */
export interface Membership {
  id: number;
  userId: number;
  organizationId: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization: { id: number; legalName: string; shortName: string | null } | null;
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

// ── Memberships (Phase 3) ─────────────────────────────────────────────────────
// The target organization is always the authenticated tenant context on the
// backend — it is never sent in a request body, params or query string.

/** Lists a user's memberships within the active organization context. */
export const fetchUserMemberships = (userId: number): Promise<Membership[]> =>
  unwrap<Membership[]>(axiosClient.get(`/users/${userId}/memberships`));

/**
 * Adds a user to the active organization (or reactivates an inactive
 * membership in place). The body is intentionally EMPTY — the target
 * organization is the tenant context, never a client-supplied id.
 */
export const addMembership = (userId: number): Promise<Membership> =>
  unwrap<Membership>(axiosClient.post(`/users/${userId}/memberships`, {}));

/** Soft-removes a membership (is_active = false; the row is never deleted). */
export const removeMembership = (membershipId: number): Promise<void> =>
  axiosClient.delete(`/users/memberships/${membershipId}`).then(() => undefined);

/** Marks a membership as the user's primary one and syncs the default org. */
export const setPrimaryMembership = (membershipId: number): Promise<Membership> =>
  unwrap<Membership>(axiosClient.patch(`/users/memberships/${membershipId}/primary`));

/** Admin-issued password reset for a user within the active organization. */
export const resetUserPassword = async (userId: number, newPassword: string): Promise<void> => {
  await axiosClient.post(`/users/${userId}/reset-password`, { newPassword });
};
