import axiosClient from './axiosClient';

// ── Shared Reference Types ───────────────────────────────────────────

export interface ReferenceItem {
  id: number;
  code: string;
  labelAr: string;
  labelEn: string;
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

export interface OrgUnitRef {
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
  assignedToOrgUnitId: number | null;
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
  assignedToOrgUnit: OrgUnitRef | null;
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
  assigneeOrgUnitId: number | null
): Promise<AdminComplaintDetail> => {
  const res = await axiosClient.patch<{ success: boolean; data: AdminComplaintDetail }>(
    `/complaints/${id}/assignment`,
    { assigneeUserId, assigneeOrgUnitId }
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
}

// ── Org Structure API ────────────────────────────────────────────────

export const fetchOrgUnits = async (): Promise<OrgUnit[]> => {
  const res = await axiosClient.get<{ success: boolean; data: OrgUnit[] }>('/org-structure/units');
  return res.data.data;
};

export const fetchGroups = async (): Promise<Group[]> => {
  const res = await axiosClient.get<{ success: boolean; data: Group[] }>('/groups');
  return res.data.data;
};
