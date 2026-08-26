import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import * as locationService from './locationService';
import { recordAuditEvent } from './auditService';
import { createNotification } from './notificationService';
import { resolveComplaintSlaFields, slaStatusForStatusChange } from './slaService';
import { sendComplaintReceipt } from './whatsappService';

const generateReferenceCode = require('../utils/generateReferenceCode') as () => string;
const { generatePin, hashPin, verifyPin } = require('../utils/pin') as {
  generatePin: () => string;
  hashPin: (pin: string) => Promise<string>;
  verifyPin: (pin: string, hash: string) => Promise<boolean>;
};
const referenceDataService = require('./referenceDataService') as {
  resolveActiveItem: (key: string, code: string, organizationId: number) => Promise<any>;
};

type DatabaseClient = typeof prisma | Prisma.TransactionClient;
type IdInput = string | number | null | undefined;

export interface ComplaintPayload {
  type: 'complaint' | 'proposal';
  isAnonymous?: boolean;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  ageGroup?: string | null;
  relationship?: string | null;
  beneficiaryExternalId?: string | null;
  governorateId: string | number;
  districtId: string | number;
  village?: string | null;
  category: string;
  priority?: string | null;
  isSensitive?: boolean;
  description: string;
  desiredResolution?: string | null;
  projectReferenceCode?: string | null;
  isRelatedToStaff?: boolean;
  relatedStaffName?: string | null;
  relatedStaffPosition?: string | null;
  staffIncidentDetails?: string | null;
  channel?: string | null;
  consentGiven?: boolean;
}

export interface UploadedComplaintFile {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface ComplaintFilters {
  page?: string | number;
  limit?: string | number;
  status?: string;
  governorateId?: string | number;
  districtId?: string | number;
  category?: string;
  priority?: string;
  isSensitive?: string | boolean;
}

const REF_ITEM_SELECT = {
  id: true,
  code: true,
  label_ar: true,
  label_en: true,
} satisfies Prisma.reference_list_itemsSelect;

const BASE_COMPLAINT_SELECT = {
  id: true,
  reference_code: true,
  type: true,
  is_anonymous: true,
  governorate_id: true,
  district_id: true,
  village: true,
  is_sensitive: true,
  description: true,
  desired_resolution: true,
  status: true,
  consent_given: true,
  assigned_to_user_id: true,
  assigned_to_organization_id: true,
  sla_rule_id: true,
  sla_due_at: true,
  sla_first_response_due_at: true,
  sla_first_responded_at: true,
  sla_status: true,
  escalation_level: true,
  last_escalated_at: true,
  create_date: true,
  write_date: true,
  create_uid: true,
  write_uid: true,
  category_item_id: true,
  channel_item_id: true,
  priority_item_id: true,
  organization_id: true,
  complainant_id: true,
  tracking_pin_hash: true,
  project_reference_code: true,
  is_related_to_staff: true,
  related_staff_name: true,
  related_staff_position: true,
  staff_incident_details: true,
  workflow_state_id: true,
  complainants: {
    select: {
      id: true,
      organization_id: true,
      full_name: true,
      phone: true,
      email: true,
      gender_item_id: true,
      age_group_item_id: true,
      relationship_item_id: true,
      beneficiary_external_id: true,
      create_date: true,
      write_date: true,
      create_uid: true,
      write_uid: true,
    },
  },
  governorates: {
    select: { id: true, name_en: true, name_ar: true },
  },
  districts: {
    select: { id: true, name_en: true, name_ar: true },
  },
  complaint_attachments: true,
  users_complaints_assigned_to_user_idTousers: {
    select: { id: true, full_name: true, email: true },
  },
  organizations_complaints_assigned_to_organization_idToorganizations: {
    select: { id: true, legal_name: true, code: true, is_active: true, deleted_at: true },
  },
  reference_list_items_complaints_category_item_idToreference_list_items: {
    select: REF_ITEM_SELECT,
  },
  reference_list_items_complaints_channel_item_idToreference_list_items: {
    select: REF_ITEM_SELECT,
  },
  reference_list_items_complaints_priority_item_idToreference_list_items: {
    select: REF_ITEM_SELECT,
  },
} satisfies Prisma.complaintsSelect;

const DETAIL_COMPLAINT_SELECT = {
  ...BASE_COMPLAINT_SELECT,
  complaint_status_history: true,
  complaint_escalation_events: { orderBy: { created_at: 'asc' as const } },
} satisfies Prisma.complaintsSelect;

type BaseComplaint = Prisma.complaintsGetPayload<{ select: typeof BASE_COMPLAINT_SELECT }>;
type DetailComplaint = Prisma.complaintsGetPayload<{ select: typeof DETAIL_COMPLAINT_SELECT }>;
type ComplaintRecord = BaseComplaint | DetailComplaint;
type ReferenceItem = Prisma.reference_list_itemsGetPayload<{ select: typeof REF_ITEM_SELECT }>;

const CREATE_ERROR = 'تعذر توليد رقم مرجعي فريد، الرجاء المحاولة لاحقاً';
const NOT_FOUND_ERROR = 'الطلب غير موجود';
const INVALID_TRACKING_ERROR = 'رقم مرجعي أو رمز متابعة غير صحيح';
const INVALID_LOCATION_ERROR = 'المحافظة أو المديرية غير صالحة';
const WORKFLOW_CODE = 'complaint_default';
const INVALID_TRANSITION_ERROR = 'انتقال حالة الطلب غير مسموح ضمن سير العمل الحالي';

const getWorkflowState = async (client: DatabaseClient, stateCode: string) => {
  const definition = await client.workflow_definitions.findFirst({
    where: { code: WORKFLOW_CODE, organization_id: null, is_active: true },
    select: { id: true },
  });
  if (!definition) throw new ApiError(503, 'سير عمل الشكاوى غير مهيأ');

  const state = await client.workflow_states.findFirst({
    where: { workflow_definition_id: definition.id, code: stateCode },
    select: { id: true },
  });
  if (!state) throw new ApiError(500, `حالة سير العمل '${stateCode}' غير مهيأة`);
  return { definitionId: definition.id, stateId: state.id };
};

const toPositiveInteger = (value: IdInput): number | null => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const requireOrganizationId = (value: IdInput): number => {
  const parsed = toPositiveInteger(value);
  if (parsed === null) {
    throw new ApiError(500, 'خطأ داخلي: لم يتم تحديد سياق المؤسسة قبل تنفيذ العملية');
  }
  return parsed;
};

const requireComplaintId = (value: IdInput): number => {
  const parsed = toPositiveInteger(value);
  if (parsed === null) throw new ApiError(404, NOT_FOUND_ERROR);
  return parsed;
};

const mapReferenceItem = (item: ReferenceItem | null) =>
  item
    ? {
        id: item.id,
        code: item.code,
        labelAr: item.label_ar,
        labelEn: item.label_en,
      }
    : null;

const collectComplainantReferenceIds = (complaints: ComplaintRecord[]): number[] => {
  const ids = complaints.flatMap((complaint) => {
    const complainant = complaint.complainants;
    return complainant
      ? [complainant.gender_item_id, complainant.age_group_item_id, complainant.relationship_item_id]
      : [];
  });
  return [...new Set(ids.filter((id): id is number => id !== null))];
};

const loadComplainantReferenceItems = async (
  complaints: ComplaintRecord[],
  client: DatabaseClient
): Promise<Map<number, ReferenceItem>> => {
  const ids = collectComplainantReferenceIds(complaints);
  if (ids.length === 0) return new Map();

  const items = await client.reference_list_items.findMany({
    where: { id: { in: ids } },
    select: REF_ITEM_SELECT,
  });
  return new Map(items.map((item) => [item.id, item]));
};

const mapComplainant = (
  complainant: BaseComplaint['complainants'],
  referenceItems: Map<number, ReferenceItem>
) => {
  if (!complainant) return null;
  return {
    id: complainant.id,
    organizationId: complainant.organization_id,
    fullName: complainant.full_name,
    phone: complainant.phone,
    email: complainant.email,
    genderItemId: complainant.gender_item_id,
    ageGroupItemId: complainant.age_group_item_id,
    relationshipItemId: complainant.relationship_item_id,
    beneficiaryExternalId: complainant.beneficiary_external_id,
    createDate: complainant.create_date,
    writeDate: complainant.write_date,
    createUid: complainant.create_uid,
    writeUid: complainant.write_uid,
    createdAt: complainant.create_date,
    updatedAt: complainant.write_date,
    genderItem: complainant.gender_item_id ? mapReferenceItem(referenceItems.get(complainant.gender_item_id) || null) : null,
    ageGroupItem: complainant.age_group_item_id
      ? mapReferenceItem(referenceItems.get(complainant.age_group_item_id) || null)
      : null,
    relationshipItem: complainant.relationship_item_id
      ? mapReferenceItem(referenceItems.get(complainant.relationship_item_id) || null)
      : null,
  };
};

const mapComplaint = (complaint: ComplaintRecord, referenceItems: Map<number, ReferenceItem>) => {
  const categoryItem = mapReferenceItem(
    complaint.reference_list_items_complaints_category_item_idToreference_list_items
  );
  const channelItem = mapReferenceItem(
    complaint.reference_list_items_complaints_channel_item_idToreference_list_items
  );
  const priorityItem = mapReferenceItem(
    complaint.reference_list_items_complaints_priority_item_idToreference_list_items
  );

  const result: Record<string, unknown> = {
    id: complaint.id,
    referenceCode: complaint.reference_code,
    organizationId: complaint.organization_id,
    complainantId: complaint.complainant_id,
    createUid: complaint.create_uid,
    writeUid: complaint.write_uid,
    createdByUserId: complaint.create_uid,
    type: complaint.type,
    isAnonymous: complaint.is_anonymous,
    trackingPinHash: complaint.tracking_pin_hash,
    governorateId: complaint.governorate_id,
    districtId: complaint.district_id,
    village: complaint.village,
    categoryItemId: complaint.category_item_id,
    priorityItemId: complaint.priority_item_id,
    isSensitive: complaint.is_sensitive,
    description: complaint.description,
    desiredResolution: complaint.desired_resolution,
    projectReferenceCode: complaint.project_reference_code,
    isRelatedToStaff: complaint.is_related_to_staff,
    relatedStaffName: complaint.related_staff_name,
    relatedStaffPosition: complaint.related_staff_position,
    staffIncidentDetails: complaint.staff_incident_details,
    channelItemId: complaint.channel_item_id,
    status: complaint.status,
    workflowStateId: complaint.workflow_state_id,
    consentGiven: complaint.consent_given,
    assignedToUserId: complaint.assigned_to_user_id,
    assignedToOrganizationId: complaint.assigned_to_organization_id,
    slaRuleId: complaint.sla_rule_id,
    slaDueAt: complaint.sla_due_at,
    slaFirstResponseDueAt: complaint.sla_first_response_due_at,
    slaFirstRespondedAt: complaint.sla_first_responded_at,
    slaStatus: complaint.sla_status,
    escalationLevel: complaint.escalation_level,
    lastEscalatedAt: complaint.last_escalated_at,
    createDate: complaint.create_date,
    writeDate: complaint.write_date,
    createdAt: complaint.create_date,
    updatedAt: complaint.write_date,
    complainant: mapComplainant(complaint.complainants, referenceItems),
    governorate: {
      id: complaint.governorates.id,
      nameEn: complaint.governorates.name_en,
      nameAr: complaint.governorates.name_ar,
    },
    district: {
      id: complaint.districts.id,
      nameEn: complaint.districts.name_en,
      nameAr: complaint.districts.name_ar,
    },
    attachments: complaint.complaint_attachments.map((attachment) => ({
      id: attachment.id,
      complaintId: attachment.complaint_id,
      originalName: attachment.original_name,
      storedFileName: attachment.stored_file_name,
      mimeType: attachment.mime_type,
      sizeBytes: attachment.size_bytes,
      createDate: attachment.create_date,
      writeDate: attachment.write_date,
      createUid: attachment.create_uid,
      writeUid: attachment.write_uid,
      createdAt: attachment.create_date,
      updatedAt: attachment.write_date,
    })),
    assignedTo: complaint.users_complaints_assigned_to_user_idTousers
      ? {
          id: complaint.users_complaints_assigned_to_user_idTousers.id,
          fullName: complaint.users_complaints_assigned_to_user_idTousers.full_name,
          email: complaint.users_complaints_assigned_to_user_idTousers.email,
        }
      : null,
    assignedToOrganization: complaint.organizations_complaints_assigned_to_organization_idToorganizations
      ? {
          id: complaint.organizations_complaints_assigned_to_organization_idToorganizations.id,
          name: complaint.organizations_complaints_assigned_to_organization_idToorganizations.legal_name,
          code: complaint.organizations_complaints_assigned_to_organization_idToorganizations.code,
        }
      : null,
    categoryItem,
    channelItem,
    priorityItem,
    category: categoryItem ? categoryItem.code : null,
    channel: channelItem ? channelItem.code : null,
    priority: priorityItem ? priorityItem.code : null,
  };

  if ('complaint_status_history' in complaint) {
    result.statusHistory = complaint.complaint_status_history.map((history) => ({
      id: history.id,
      complaintId: history.complaint_id,
      fromStatus: history.from_status,
      toStatus: history.to_status,
      note: history.note,
      changedByUserId: history.changed_by_user_id,
      createdAt: history.created_at,
    }));
  }

  if ('complaint_escalation_events' in complaint) {
    result.escalationEvents = complaint.complaint_escalation_events.map((event) => ({
      id: event.id,
      organizationId: event.organization_id,
      complaintId: event.complaint_id,
      slaRuleId: event.sla_rule_id,
      fromLevel: event.from_level,
      toLevel: event.to_level,
      reason: event.reason,
      note: event.note,
      triggeredByUserId: event.triggered_by_user_id,
      createdAt: event.created_at,
    }));
  }

  return result;
};

const resolveComplaintItems = async (payload: ComplaintPayload, organizationId: number) => {
  const [genderItem, ageGroupItem, relationshipItem, categoryItem, channelItem, priorityItem] = await Promise.all([
    payload.gender ? referenceDataService.resolveActiveItem('gender', payload.gender, organizationId) : null,
    payload.ageGroup ? referenceDataService.resolveActiveItem('age_group', payload.ageGroup, organizationId) : null,
    payload.relationship
      ? referenceDataService.resolveActiveItem('complainant_relationship', payload.relationship, organizationId)
      : null,
    referenceDataService.resolveActiveItem('complaint_category', payload.category, organizationId),
    referenceDataService.resolveActiveItem('channel', payload.channel || 'website', organizationId),
    payload.priority
      ? referenceDataService.resolveActiveItem('complaint_priority', payload.priority, organizationId)
      : prisma.reference_list_items.findFirst({
          where: {
            is_active: true,
            is_default: true,
            reference_lists: { key: 'complaint_priority', OR: [{ organization_id: null }, { organization_id: organizationId }] },
          },
        }),
  ]);
  return { genderItem, ageGroupItem, relationshipItem, categoryItem, channelItem, priorityItem };
};

export const createComplaint = async (
  organizationId: IdInput,
  payload: ComplaintPayload,
  files: UploadedComplaintFile[] = [],
  createdByUserId: IdInput = null
) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const parsedCreatedByUserId = createdByUserId === null || createdByUserId === undefined
    ? null
    : toPositiveInteger(createdByUserId);

  const result = await prisma.$transaction(async (tx) => {
    const initialWorkflowState = await getWorkflowState(tx, 'new');
    await locationService.validateGovernorateDistrictPair(payload.governorateId, payload.districtId);
    const governorateId = toPositiveInteger(payload.governorateId);
    const districtId = toPositiveInteger(payload.districtId);
    if (governorateId === null || districtId === null) throw new ApiError(422, INVALID_LOCATION_ERROR);
    const { genderItem, ageGroupItem, relationshipItem, categoryItem, channelItem, priorityItem } = await resolveComplaintItems(
      payload,
      parsedOrganizationId
    );

    let complainantId: number | null = null;
    const hasIdentityData =
      !payload.isAnonymous && (payload.fullName || payload.phone || payload.email || payload.relationship);
    if (hasIdentityData) {
      const now = new Date();
      const complainant = await tx.complainants.create({
        data: {
          organization_id: parsedOrganizationId,
          full_name: payload.fullName || null,
          phone: payload.phone || null,
          email: payload.email || null,
          gender_item_id: genderItem ? genderItem.id : null,
          age_group_item_id: ageGroupItem ? ageGroupItem.id : null,
          relationship_item_id: relationshipItem ? relationshipItem.id : null,
          beneficiary_external_id: payload.beneficiaryExternalId || null,
          create_date: now,
          write_date: now,
          create_uid: parsedCreatedByUserId,
          write_uid: parsedCreatedByUserId,
        },
      });
      complainantId = complainant.id;
    }

    let referenceCode: string | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateReferenceCode();
      const existing = await tx.complaints.findUnique({
        where: { reference_code: candidate },
        select: { id: true },
      });
      if (!existing) {
        referenceCode = candidate;
        break;
      }
    }
    if (!referenceCode) throw new ApiError(500, CREATE_ERROR);

    const trackingPin = generatePin();
    const trackingPinHash = await hashPin(trackingPin);
    const now = new Date();
    const isSensitive = !!payload.isSensitive || !!(categoryItem.meta && categoryItem.meta.forcesSensitive);
    const slaFields = await resolveComplaintSlaFields(tx, parsedOrganizationId, {
      type: payload.type,
      categoryItemId: categoryItem.id,
      priorityItemId: priorityItem ? priorityItem.id : null,
      isSensitive,
      createdAt: now,
    });
    const complaint = await tx.complaints.create({
      data: {
        reference_code: referenceCode,
        organization_id: parsedOrganizationId,
        complainant_id: complainantId,
        tracking_pin_hash: trackingPinHash,
        create_uid: parsedCreatedByUserId,
        write_uid: parsedCreatedByUserId,
        type: payload.type,
        is_anonymous: !!payload.isAnonymous,
        governorate_id: governorateId,
        district_id: districtId,
        village: payload.village || null,
        category_item_id: categoryItem.id,
        channel_item_id: channelItem.id,
        priority_item_id: priorityItem ? priorityItem.id : null,
        is_sensitive: isSensitive,
        description: payload.description,
        desired_resolution: payload.desiredResolution || null,
        project_reference_code: payload.projectReferenceCode || null,
        is_related_to_staff: !!payload.isRelatedToStaff,
        related_staff_name: payload.isRelatedToStaff ? payload.relatedStaffName || null : null,
        related_staff_position: payload.isRelatedToStaff ? payload.relatedStaffPosition || null : null,
        staff_incident_details: payload.isRelatedToStaff ? payload.staffIncidentDetails || null : null,
        consent_given: !!payload.consentGiven,
        status: 'new',
        workflow_state_id: initialWorkflowState.stateId,
        create_date: now,
        write_date: now,
        ...slaFields,
      },
      select: { id: true },
    });

    if (files.length > 0) {
      await tx.complaint_attachments.createMany({
        data: files.map((file) => {
          const attachmentNow = new Date();
          return {
            complaint_id: complaint.id,
            original_name: file.originalname,
            stored_file_name: file.filename,
            mime_type: file.mimetype,
            size_bytes: file.size,
            create_date: attachmentNow,
            write_date: attachmentNow,
            create_uid: parsedCreatedByUserId,
            write_uid: parsedCreatedByUserId,
          };
        }),
      });
    }

    await tx.complaint_status_history.create({
      data: {
        complaint_id: complaint.id,
        from_status: null,
        to_status: 'new',
        note: 'تم إنشاء الطلب',
        changed_by_user_id: parsedCreatedByUserId,
        created_at: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: parsedCreatedByUserId,
      action: 'complaint.created',
      entityType: 'complaint',
      entityId: complaint.id,
      metadata: { referenceCode, type: payload.type, status: 'new' },
    });

    const created = await tx.complaints.findUnique({
      where: { id: complaint.id },
      select: BASE_COMPLAINT_SELECT,
    });
    if (!created) throw new ApiError(500, 'تعذر قراءة الشكوى بعد إنشائها');
    const referenceItems = await loadComplainantReferenceItems([created], tx);
    return { 
      complaint: mapComplaint(created, referenceItems), 
      trackingPin, 
      referenceCode, 
      phone: payload.phone 
    };
  });

  // Safe async WhatsApp notification (fire and forget)
  if (result.phone && result.referenceCode) {
    sendComplaintReceipt(parsedOrganizationId, result.phone, result.referenceCode, result.trackingPin)
      .catch((error: unknown) => console.error('[WhatsApp] Unhandled error:', error));
  }

  return { complaint: result.complaint, trackingPin: result.trackingPin };
};

export const listComplaints = async (organizationId: IdInput, filters: ComplaintFilters = {}) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const page = Number.parseInt(String(filters.page || ''), 10) || 1;
  const limit = Number.parseInt(String(filters.limit || ''), 10) || 20;
  const where: Prisma.complaintsWhereInput = { organization_id: parsedOrganizationId };

  if (filters.status) where.status = filters.status as Prisma.complaintsWhereInput['status'];
  if (filters.governorateId !== undefined) {
    const governorateId = toPositiveInteger(filters.governorateId);
    if (governorateId === null) throw new ApiError(422, INVALID_LOCATION_ERROR);
    where.governorate_id = governorateId;
  }
  if (filters.districtId !== undefined) {
    const districtId = toPositiveInteger(filters.districtId);
    if (districtId === null) throw new ApiError(422, INVALID_LOCATION_ERROR);
    where.district_id = districtId;
  }
  if (filters.category) {
    const categoryItem = await referenceDataService.resolveActiveItem(
      'complaint_category',
      filters.category,
      parsedOrganizationId
    );
    where.category_item_id = categoryItem.id;
  }
  if (filters.isSensitive !== undefined) {
    where.is_sensitive = filters.isSensitive === 'true' || filters.isSensitive === true;
  }

  const [rows, total] = await Promise.all([
    prisma.complaints.findMany({
      where,
      select: BASE_COMPLAINT_SELECT,
      orderBy: { create_date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.complaints.count({ where }),
  ]);
  const referenceItems = await loadComplainantReferenceItems(rows, prisma);

  return {
    data: rows.map((row) => mapComplaint(row, referenceItems)),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const getComplaintById = async (organizationId: IdInput, id: IdInput) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const parsedId = requireComplaintId(id);
  const complaint = await prisma.complaints.findFirst({
    where: { id: parsedId, organization_id: parsedOrganizationId },
    select: DETAIL_COMPLAINT_SELECT,
  });
  if (!complaint) throw new ApiError(404, NOT_FOUND_ERROR);
  const referenceItems = await loadComplainantReferenceItems([complaint], prisma);
  return mapComplaint(complaint, referenceItems);
};

export const updateComplaintStatus = async (
  organizationId: IdInput,
  id: IdInput,
  newStatus: string,
  note: string | null | undefined,
  changedByUserId: IdInput
) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const parsedId = requireComplaintId(id);
  const parsedChangedByUserId = toPositiveInteger(changedByUserId);

  return prisma.$transaction(async (tx) => {
    const complaint = await tx.complaints.findFirst({
      where: { id: parsedId, organization_id: parsedOrganizationId },
      select: {
        id: true,
        status: true,
        assigned_to_user_id: true,
        sla_due_at: true,
        sla_first_responded_at: true,
      },
    });
    if (!complaint) throw new ApiError(404, NOT_FOUND_ERROR);

    const currentWorkflowState = await getWorkflowState(tx, complaint.status);
    const targetWorkflowState = await getWorkflowState(tx, newStatus);
    const transition = await tx.workflow_transitions.findFirst({
      where: {
        workflow_definition_id: currentWorkflowState.definitionId,
        from_state_id: currentWorkflowState.stateId,
        to_state_id: targetWorkflowState.stateId,
      },
      select: { id: true },
    });
    if (!transition) throw new ApiError(409, INVALID_TRANSITION_ERROR);

    const statusChangedAt = new Date();
    const slaPatch = slaStatusForStatusChange({
      previousStatus: complaint.status,
      nextStatus: newStatus,
      slaDueAt: complaint.sla_due_at,
      slaFirstRespondedAt: complaint.sla_first_responded_at,
      now: statusChangedAt,
    });
    const updateResult = await tx.complaints.updateMany({
      where: { id: complaint.id, organization_id: parsedOrganizationId, status: complaint.status },
      data: {
        status: newStatus as Prisma.complaintsUpdateInput['status'],
        workflow_state_id: targetWorkflowState.stateId,
        write_date: statusChangedAt,
        write_uid: parsedChangedByUserId,
        ...slaPatch,
      },
    });
    if (updateResult.count !== 1) throw new ApiError(409, INVALID_TRANSITION_ERROR);
    await tx.complaint_status_history.create({
      data: {
        complaint_id: complaint.id,
        from_status: complaint.status,
        to_status: newStatus,
        note: note || null,
        changed_by_user_id: parsedChangedByUserId,
        created_at: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: parsedChangedByUserId,
      action: 'complaint.status_changed',
      entityType: 'complaint',
      entityId: complaint.id,
      metadata: { fromStatus: complaint.status, toStatus: newStatus },
    });
    if (complaint.assigned_to_user_id !== null) {
      await createNotification(tx, {
        organizationId: parsedOrganizationId,
        userId: complaint.assigned_to_user_id,
        notificationType: 'complaint.status_changed',
        title: 'تحديث حالة الشكوى',
        message: `تم تغيير حالة الشكوى إلى ${newStatus}`,
        entityType: 'complaint',
        entityId: complaint.id,
        metadata: { fromStatus: complaint.status, toStatus: newStatus },
      });
    }

    const updated = await tx.complaints.findFirst({
      where: { id: complaint.id, organization_id: parsedOrganizationId },
      select: DETAIL_COMPLAINT_SELECT,
    });
    if (!updated) throw new ApiError(404, NOT_FOUND_ERROR);
    const referenceItems = await loadComplainantReferenceItems([updated], tx);
    return mapComplaint(updated, referenceItems);
  });
};

export interface ComplaintAssignmentInput {
  assigneeUserId?: IdInput;
  assigneeOrganizationId?: IdInput;
}

const parseOptionalAssigneeId = (value: IdInput, invalidMessage: string): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toPositiveInteger(value);
  if (parsed === null) throw new ApiError(422, invalidMessage);
  return parsed;
};

export const assignComplaint = async (
  organizationId: IdInput,
  id: IdInput,
  assignment: ComplaintAssignmentInput,
  assignedByUserId: IdInput
) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const parsedId = requireComplaintId(id);
  const parsedAssigneeUserId = parseOptionalAssigneeId(assignment?.assigneeUserId, 'المستخدم المعيّن غير صالح');
  const parsedAssigneeOrgNodeId = parseOptionalAssigneeId(
    assignment?.assigneeOrganizationId,
    'الوحدة التنظيمية المعيّنة غير صالحة'
  );
  const parsedAssignedByUserId = toPositiveInteger(assignedByUserId);

  return prisma.$transaction(async (tx) => {
    const complaint = await tx.complaints.findFirst({
      where: { id: parsedId, organization_id: parsedOrganizationId },
      select: { id: true, assigned_to_user_id: true, assigned_to_organization_id: true },
    });
    if (!complaint) throw new ApiError(404, NOT_FOUND_ERROR);

    if (parsedAssigneeUserId !== null) {
      const assignee = await tx.users.findFirst({
        where: {
          id: parsedAssigneeUserId,
          is_active: true,
          user_organizations: { some: { organization_id: parsedOrganizationId, is_active: true } },
        },
        select: { id: true },
      });
      if (!assignee) throw new ApiError(422, 'المستخدم المعيّن غير نشط أو لا ينتمي إلى مؤسستك');
    }

    if (parsedAssigneeOrgNodeId !== null) {
      const orgNode = await tx.organizations.findFirst({
        where: {
          id: parsedAssigneeOrgNodeId,
          is_active: true,
          deleted_at: null,
          OR: [{ id: parsedOrganizationId }, { root_organization_id: parsedOrganizationId }],
        },
        select: { id: true },
      });
      if (!orgNode) {
        throw new ApiError(422, 'الوحدة التنظيمية المعيّنة غير نشطة أو لا تنتمي إلى مؤسستك');
      }
    }

    const updated = await tx.complaints.updateMany({
      where: {
        id: complaint.id,
        organization_id: parsedOrganizationId,
        assigned_to_user_id: complaint.assigned_to_user_id,
        assigned_to_organization_id: complaint.assigned_to_organization_id,
      },
      data: {
        assigned_to_user_id: parsedAssigneeUserId,
        assigned_to_organization_id: parsedAssigneeOrgNodeId,
        write_date: new Date(),
      },
    });
    if (updated.count !== 1) throw new ApiError(409, 'تغير تعيين الشكوى قبل إتمام العملية');

    const isUnassigned = parsedAssigneeUserId === null && parsedAssigneeOrgNodeId === null;
    await recordAuditEvent(tx, {
      organizationId: parsedOrganizationId,
      actorUserId: parsedAssignedByUserId,
      action: isUnassigned ? 'complaint.unassigned' : 'complaint.assigned',
      entityType: 'complaint',
      entityId: complaint.id,
      metadata: {
        previousAssigneeId: complaint.assigned_to_user_id,
        assigneeUserId: parsedAssigneeUserId,
        previousAssigneeOrganizationId: complaint.assigned_to_organization_id,
        assigneeOrganizationId: parsedAssigneeOrgNodeId,
      },
    });

    if (parsedAssigneeUserId !== null) {
      await createNotification(tx, {
        organizationId: parsedOrganizationId,
        userId: parsedAssigneeUserId,
        notificationType: 'complaint.assigned',
        title: 'تم تعيين شكوى لك',
        message: 'تم تعيين شكوى جديدة لك للمتابعة',
        entityType: 'complaint',
        entityId: complaint.id,
        metadata: {
          previousAssigneeId: complaint.assigned_to_user_id,
          previousAssigneeOrganizationId: complaint.assigned_to_organization_id,
          assigneeOrganizationId: parsedAssigneeOrgNodeId,
        },
      });
    }

    const result = await tx.complaints.findFirst({
      where: { id: complaint.id, organization_id: parsedOrganizationId },
      select: DETAIL_COMPLAINT_SELECT,
    });
    if (!result) throw new ApiError(404, NOT_FOUND_ERROR);
    const referenceItems = await loadComplainantReferenceItems([result], tx);
    return mapComplaint(result, referenceItems);
  });
};

const SIMPLIFIED_STATUS_MAP: Record<string, string> = {
  new: 'تم استلام الشكوى',
  in_review: 'قيد المراجعة',
  resolved: 'تم الحل',
  closed: 'أُغلقت',
  rejected: 'أُغلقت',
};

export const trackComplaint = async (organizationId: IdInput, referenceCode: string, pin: string) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const complaint = await prisma.complaints.findFirst({
    where: { organization_id: parsedOrganizationId, reference_code: referenceCode },
    select: {
      reference_code: true,
      status: true,
      tracking_pin_hash: true,
      create_date: true,
      write_date: true,
    },
  });
  if (!complaint || !complaint.tracking_pin_hash) throw new ApiError(404, INVALID_TRACKING_ERROR);

  const isValidPin = await verifyPin(pin, complaint.tracking_pin_hash);
  if (!isValidPin) throw new ApiError(404, INVALID_TRACKING_ERROR);

  return {
    referenceCode: complaint.reference_code,
    status: complaint.status,
    statusLabel: SIMPLIFIED_STATUS_MAP[complaint.status] || complaint.status,
    createDate: complaint.create_date,
    writeDate: complaint.write_date,
    submittedAt: complaint.create_date,
    lastUpdatedAt: complaint.write_date,
  };
};
