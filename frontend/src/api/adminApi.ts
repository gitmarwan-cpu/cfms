import axiosClient from './axiosClient';

// ── Shared Reference Types ───────────────────────────────────────────

export interface ReferenceItem {
  id: number;
  code: string;
  labelAr: string;
  labelEn: string | null;
  referenceListId?: number;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationRef {
  id: number;
  nameEn: string;
  nameAr: string;
}

export interface UserRef {
  id: number;
  fullName: string;
  email: string;
}

export interface OrganizationRef {
  id: number;
  name: string;
  code: string;
}

// ── Pagination ───────────────────────────────────────────────────────

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Complainant ──────────────────────────────────────────────────────

export interface Complainant {
  id: number;
  organizationId: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  genderItemId: number | null;
  ageGroupItemId: number | null;
  relationshipItemId: number | null;
  beneficiaryExternalId: string | null;
  genderItem?: ReferenceItem | null;
  ageGroupItem?: ReferenceItem | null;
  relationshipItem?: ReferenceItem | null;
}

// ── Complaint Types ──────────────────────────────────────────────────

export type ComplaintStatus = 'new' | 'in_review' | 'resolved' | 'closed' | 'rejected';
export type SlaStatus = 'none' | 'on_track' | 'overdue' | 'met';

export interface Attachment {
  id: number;
  complaintId: number;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface StatusHistoryEntry {
  id: number;
  complaintId: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  changedByUserId: number | null;
  createdAt: string;
}

export interface EscalationEvent {
  id: number;
  organizationId: number;
  complaintId: number;
  slaRuleId: number | null;
  fromLevel: number;
  toLevel: number;
  reason: string;
  note: string | null;
  triggeredByUserId: number | null;
  createdAt: string;
}

export interface AdminComplaint {
  id: number;
  referenceCode: string;
  organizationId: number;
  complainantId: number;
  createdByUserId: number | null;
  type: 'complaint' | 'proposal';
  isAnonymous: boolean;
  governorateId: number | null;
  districtId: number | null;
  village: string | null;
  categoryItemId: number | null;
  priorityItemId: number | null;
  channelItemId: number | null;
  isSensitive: boolean;
  description: string;
  desiredResolution: string | null;
  projectReferenceCode: string | null;
  isRelatedToStaff: boolean;
  relatedStaffName: string | null;
  relatedStaffPosition: string | null;
  staffIncidentDetails: string | null;
  status: ComplaintStatus;
  assignedToUserId: number | null;
  assignedToOrganizationId: number | null;
  slaRuleId: number | null;
  slaDueAt: string | null;
  slaFirstResponseDueAt: string | null;
  slaFirstRespondedAt: string | null;
  slaStatus: SlaStatus;
  escalationLevel: number;
  lastEscalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Nested relations
  complainant: Complainant | null;
  governorate: LocationRef | null;
  district: LocationRef | null;
  attachments: Attachment[];
  assignedTo: UserRef | null;
  assignedToOrganization: OrganizationRef | null;
  categoryItem: ReferenceItem | null;
  channelItem: ReferenceItem | null;
  priorityItem: ReferenceItem | null;
  // Virtual string fields
  category: string | null;
  channel: string | null;
  priority: string | null;
}

export interface AdminComplaintDetail extends AdminComplaint {
  statusHistory: StatusHistoryEntry[];
  escalationEvents: EscalationEvent[];
}

export interface ComplaintTransition {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
  toStatus: ComplaintStatus;
}

// ── Complaint List Filters ───────────────────────────────────────────

export interface ComplaintListFilters {
  page?: number;
  limit?: number;
  status?: ComplaintStatus;
  governorateId?: number;
  districtId?: number;
  category?: string;
  priority?: string;
  isSensitive?: boolean;
}

// ── Complaint API ────────────────────────────────────────────────────

interface ComplaintListResponse {
  success: boolean;
  data: AdminComplaint[];
  pagination: PaginationInfo;
}

export const fetchComplaints = async (
  filters: ComplaintListFilters = {}
): Promise<{ data: AdminComplaint[]; pagination: PaginationInfo }> => {
  const params = new URLSearchParams();
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.status) params.append('status', filters.status);
  if (filters.governorateId) params.append('governorateId', String(filters.governorateId));
  if (filters.districtId) params.append('districtId', String(filters.districtId));
  if (filters.category) params.append('category', filters.category);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.isSensitive !== undefined) params.append('isSensitive', String(filters.isSensitive));

  const query = params.toString();
  const url = query ? `/complaints?${query}` : '/complaints';
  const res = await axiosClient.get<ComplaintListResponse>(url);
  return {
    data: res.data.data,
    pagination: res.data.pagination,
  };
};

export const getComplaint = async (id: number): Promise<AdminComplaintDetail> => {
  const res = await axiosClient.get<{ success: boolean; data: AdminComplaintDetail }>(
    `/complaints/${id}`
  );
  return res.data.data;
};

export const fetchComplaintTransitions = async (id: number): Promise<ComplaintTransition[]> => {
  const res = await axiosClient.get<{ success: boolean; data: ComplaintTransition[] }>(
    `/complaints/${id}/transitions`
  );
  return res.data.data;
};

export const updateComplaintStatus = async (
  id: number,
  status: ComplaintStatus,
  note?: string
): Promise<AdminComplaintDetail> => {
  const res = await axiosClient.patch<{ success: boolean; data: AdminComplaintDetail }>(
    `/complaints/${id}/status`,
    { status, note }
  );
  return res.data.data;
};

export const updateComplaintAssignment = async (
  id: number,
  assigneeUserId: number | null,
  assigneeOrganizationId: number | null
): Promise<AdminComplaintDetail> => {
  const res = await axiosClient.patch<{ success: boolean; data: AdminComplaintDetail }>(
    `/complaints/${id}/assignment`,
    { assigneeUserId, assigneeOrganizationId }
  );
  return res.data.data;
};

export const escalateComplaint = async (
  id: number,
  note?: string
): Promise<AdminComplaintDetail> => {
  const res = await axiosClient.post<{ success: boolean; data: AdminComplaintDetail }>(
    `/complaints/${id}/escalate`,
    { note }
  );
  return res.data.data;
};

// ── Notification Types ───────────────────────────────────────────────

export interface Notification {
  id: number;
  organizationId: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: number | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

// ── Notification API ─────────────────────────────────────────────────

interface NotificationListResponse {
  success: boolean;
  data: Notification[];
  unreadCount: number;
  pagination: PaginationInfo;
}

export const fetchNotifications = async (
  params: { page?: number; limit?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: Notification[]; unreadCount: number; pagination: PaginationInfo }> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', String(params.page));
  if (params.limit) searchParams.append('limit', String(params.limit));
  if (params.unreadOnly !== undefined) searchParams.append('unreadOnly', String(params.unreadOnly));

  const query = searchParams.toString();
  const url = query ? `/notifications?${query}` : '/notifications';
  const res = await axiosClient.get<NotificationListResponse>(url);
  return {
    notifications: res.data.data,
    unreadCount: res.data.unreadCount,
    pagination: res.data.pagination,
  };
};

export const markNotificationRead = async (id: number): Promise<void> => {
  await axiosClient.patch(`/notifications/${id}/read`);
};

// ── Report Types ─────────────────────────────────────────────────────

export interface ReportData {
  period: {
    from: string;
    to: string;
  };
  summary: {
    total: number;
    assigned: number;
    unassigned: number;
    sensitive: number;
  };
  byStatus: Array<{
    status: string;
    total: number;
  }>;
  byCategory: Array<{
    itemId: number;
    code: string;
    labelAr: string;
    labelEn: string;
    total: number;
  }>;
  byMonth: Array<{
    period: string;
    total: number;
  }>;
}

// ── Report API ───────────────────────────────────────────────────────

export const fetchReportData = async (
  from?: string,
  to?: string
): Promise<ReportData> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);

  const query = params.toString();
  const url = query ? `/reports/complaints?${query}` : '/reports/complaints';
  const res = await axiosClient.get<{ success: boolean; data: ReportData }>(url);
  return res.data.data;
};

// ── Org Structure Types ──────────────────────────────────────────────

export interface OrgUnit {
  id: number;
  organizationId: number;
  orgUnitTypeId: number;
  parentId: number | null;
  name: string;
  code: string | null;
  isActive: boolean;
  unitType?: {
    id: number;
    code: string;
    nameAr: string;
    nameEn: string | null;
  };
  manager?: UserRef | null;
}

export interface Group {
  id: number;
  organizationId: number;
  code: string;
  nameAr: string;
  nameEn: string | null;
  description: string | null;
  isActive: boolean;
  roles?: Pick<Role, 'id' | 'code' | 'nameAr' | 'nameEn'>[];
}

// ── Org Structure API ────────────────────────────────────────────────

export const fetchOrgUnits = async (): Promise<any[]> => {
  return fetchOrganizationNodes();
};

// ── Organization Nodes API (authoritative hierarchy backend endpoint /organization/nodes) ──

export interface OrganizationNodeDto {
  id: number;
  name: string;
  shortName: string | null;
  code: string | null;
  parentId: number | null;
  rootOrganizationId: number | null;
  orgUnitTypeId: number | null;
  countryId: number | null;
  governorateId: number | null;
  districtId: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  unitType: {
    id: number;
    code: string;
    nameAr: string;
    nameEn: string | null;
    hierarchyLevel: number;
  } | null;
}

export interface CreateOrganizationNodeInput {
  name: string;
  shortName?: string | null;
  code?: string | null;
  orgUnitTypeId: number;
  parentId?: number | null;
  countryId?: number | null;
  governorateId?: number | null;
  districtId?: number | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
}

export interface UpdateOrganizationNodeInput {
  name?: string;
  shortName?: string | null;
  code?: string | null;
  orgUnitTypeId?: number;
  parentId?: number | null;
  countryId?: number | null;
  governorateId?: number | null;
  districtId?: number | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
}

/** Fetches organizational hierarchy nodes from the backend (/organization/nodes). */
export const fetchOrganizationNodes = async (): Promise<OrganizationNodeDto[]> => {
  const res = await axiosClient.get<{ success: boolean; data: OrganizationNodeDto[] }>('/organization/nodes');
  return res.data.data;
};

/** Creates a node in the organizational hierarchy (/organization/nodes). */
export const createOrganizationNode = (payload: CreateOrganizationNodeInput): Promise<OrganizationNodeDto> =>
  unwrap<OrganizationNodeDto>(axiosClient.post('/organization/nodes', payload));

/** Updates an existing node in the organizational hierarchy (/organization/nodes/:id). */
export const updateOrganizationNode = (id: number, payload: UpdateOrganizationNodeInput): Promise<OrganizationNodeDto> =>
  unwrap<OrganizationNodeDto>(axiosClient.put(`/organization/nodes/${id}`, payload));

/** Deactivates an organization node (/organization/nodes/:id/deactivate). */
export const deactivateOrganizationNode = (id: number): Promise<OrganizationNodeDto> =>
  unwrap<OrganizationNodeDto>(axiosClient.patch(`/organization/nodes/${id}/deactivate`));

export const fetchGroups = async (): Promise<Group[]> => {
  const res = await axiosClient.get<{ success: boolean; data: Group[] }>('/groups');
  return res.data.data;
};

// ── Administration APIs (contracts mirrored from backend/src/routes) ──

export interface Permission { id: number; code: string; nameAr: string; descriptionAr?: string | null; module?: string | null; }
export interface Role {
  id: number; code: string; organizationId: number | null; nameAr: string; nameEn: string | null;
  description: string | null; isSystem: boolean; isActive: boolean; permissions: Permission[];
}
export interface ReferenceList { id: number; key: string; nameAr: string; nameEn: string | null; items?: ReferenceItem[]; }
export interface OrganizationSettings {
  id: number; legalName: string; shortName: string | null; logoUrl: string | null; faviconUrl: string | null;
  description: string | null; vision: string | null; mission: string | null; phone: string | null; email: string | null;
  website: string | null; country: string | null; countryId: number | null; governorateId: number | null; districtId: number | null;
  city: string | null; address: string | null; defaultLanguage: 'ar' | 'en'; timezone: string | null; primaryColor: string | null;
  secondaryColor: string | null; accentColor: string | null; anonymousComplaintsPolicy: 'allowed' | 'not_allowed' | 'optional';
}
export interface OrgUnitType { id: number; code: string; nameAr: string; nameEn: string | null; hierarchyLevel: number; isActive: boolean; allowedParentTypeId: number | null; }
export interface SlaRule { id: number; name: string; complaintType: 'complaint' | 'proposal' | null; categoryItemId: number | null; priorityItemId: number | null; isSensitive: boolean | null; firstResponseHours: number; resolutionHours: number; escalationIntervalHours: number; maxEscalationLevel: number; isActive: boolean; createdAt: string; updatedAt: string; }
export interface AuditLog { id: number; actor: UserRef | null; action: string; entityType: string; entityId: number | null; metadata: unknown; createdAt: string; }

const unwrap = async <T>(request: Promise<{ data: { data: T } }>): Promise<T> => (await request).data.data;
export const fetchRoles = () => unwrap<Role[]>(axiosClient.get('/roles'));
export const fetchPermissions = () => unwrap<Permission[]>(axiosClient.get('/roles/permissions'));
export const createRole = (payload: Pick<Role, 'code' | 'nameAr' | 'nameEn' | 'description'> & { permissionIds: number[] }) => unwrap<Role>(axiosClient.post('/roles', payload));
export const updateRole = (id: number, payload: Partial<Pick<Role, 'nameAr' | 'nameEn' | 'description' | 'isActive'>> & { permissionIds?: number[] }) => unwrap<Role>(axiosClient.put(`/roles/${id}`, payload));
export const deleteRole = (id: number) => axiosClient.delete(`/roles/${id}`);
export const createGroup = (payload: Pick<Group, 'code' | 'nameAr' | 'nameEn' | 'description'> & { roleIds: number[] }) => unwrap<Group>(axiosClient.post('/groups', payload));
export const fetchGroup = (id: number) => unwrap<Group>(axiosClient.get(`/groups/${id}`));
export const updateGroup = (id: number, payload: Partial<Pick<Group, 'nameAr' | 'nameEn' | 'description' | 'isActive'>> & { roleIds?: number[] }) => unwrap<Group>(axiosClient.put(`/groups/${id}`, payload));
export const deleteGroup = (id: number) => axiosClient.delete(`/groups/${id}`);
export const fetchOrganization = () => unwrap<OrganizationSettings>(axiosClient.get('/organization'));
export const updateOrganization = (payload: Partial<OrganizationSettings>) => unwrap<OrganizationSettings>(axiosClient.put('/organization', payload));
export const fetchOrgUnitTypes = () => unwrap<OrgUnitType[]>(axiosClient.get('/org-structure/unit-types'));
export const createOrgUnit = (payload: Record<string, unknown>) => unwrap<OrgUnit>(axiosClient.post('/org-structure/units', payload));
export const updateOrgUnit = (id: number, payload: Record<string, unknown>) => unwrap<OrgUnit>(axiosClient.put(`/org-structure/units/${id}`, payload));
export const deactivateOrgUnit = (id: number) => axiosClient.patch(`/org-structure/units/${id}/deactivate`);
export const fetchReferenceLists = () => unwrap<ReferenceList[]>(axiosClient.get('/reference-data'));
export const fetchAdminReferenceItems = (key: string) => unwrap<ReferenceItem[]>(axiosClient.get(`/reference-data/${key}/items/admin`));
export const createReferenceItem = (key: string, payload: Record<string, unknown>) => unwrap<ReferenceItem>(axiosClient.post(`/reference-data/${key}/items`, payload));
export const updateReferenceItem = (key: string, id: number, payload: Record<string, unknown>) => unwrap<ReferenceItem>(axiosClient.put(`/reference-data/${key}/items/${id}`, payload));
export const deactivateReferenceItem = (key: string, id: number) => axiosClient.patch(`/reference-data/${key}/items/${id}/deactivate`);
export const fetchSlaRules = () => unwrap<SlaRule[]>(axiosClient.get('/sla-rules'));
export const createSlaRule = (payload: Record<string, unknown>) => unwrap<SlaRule>(axiosClient.post('/sla-rules', payload));
export const updateSlaRule = (id: number, payload: Record<string, unknown>) => unwrap<SlaRule>(axiosClient.patch(`/sla-rules/${id}`, payload));
export const evaluateSla = () => unwrap<{ evaluated: number; overdue: number; escalated: number }>(axiosClient.post('/sla-rules/evaluate'));
export const fetchAuditLogs = async (params: { page?: number; limit?: number; entityType?: string; entityId?: string } = {}) => {
  const response = await axiosClient.get<{ data: AuditLog[]; pagination: PaginationInfo }>('/audit-logs', { params });
  return response.data;
};
