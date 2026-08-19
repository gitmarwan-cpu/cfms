import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';
import { recordAuditEvent } from './auditService';
import { createNotification } from './notificationService';

type DatabaseClient = typeof prisma | Prisma.TransactionClient;
type IdInput = string | number | null | undefined;

export const MS_PER_HOUR = 60 * 60 * 1000;
export const TERMINAL_STATUSES = ['resolved', 'closed', 'rejected'] as const;
export const OPEN_STATUSES = ['new', 'in_review'] as const;
export const DEFAULT_MAX_ESCALATION_LEVEL = 3;

export type SlaStatus = 'none' | 'on_track' | 'overdue' | 'met';
export type EscalationReason = 'overdue' | 'manual';

export interface SlaRulePayload {
  name: string;
  complaintType?: 'complaint' | 'proposal' | null;
  categoryItemId?: IdInput;
  priorityItemId?: IdInput;
  isSensitive?: boolean | null;
  firstResponseHours: number;
  resolutionHours: number;
  escalationIntervalHours: number;
  maxEscalationLevel?: number;
  isActive?: boolean;
}

export interface SlaRuleUpdatePayload {
  name?: string;
  complaintType?: 'complaint' | 'proposal' | null;
  categoryItemId?: IdInput;
  priorityItemId?: IdInput;
  isSensitive?: boolean | null;
  firstResponseHours?: number;
  resolutionHours?: number;
  escalationIntervalHours?: number;
  maxEscalationLevel?: number;
  isActive?: boolean;
}

export interface ComplaintSlaMatchInput {
  type: 'complaint' | 'proposal';
  categoryItemId: number;
  priorityItemId?: number | null;
  isSensitive: boolean;
  createdAt: Date;
}

const SLA_RULE_SELECT = {
  id: true,
  organization_id: true,
  name: true,
  complaint_type: true,
  category_item_id: true,
  priority_item_id: true,
  is_sensitive: true,
  first_response_hours: true,
  resolution_hours: true,
  escalation_interval_hours: true,
  max_escalation_level: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.sla_rulesSelect;

type SlaRuleRecord = Prisma.sla_rulesGetPayload<{ select: typeof SLA_RULE_SELECT }>;

const toPositiveInteger = (value: IdInput): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
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

const requireRuleId = (value: IdInput): number => {
  const parsed = toPositiveInteger(value);
  if (parsed === null) throw new ApiError(404, 'قاعدة مهلة المعالجة غير موجودة');
  return parsed;
};

const requireComplaintId = (value: IdInput): number => {
  const parsed = toPositiveInteger(value);
  if (parsed === null) throw new ApiError(404, 'الطلب غير موجود');
  return parsed;
};

const optionalNullableInt = (value: IdInput): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = toPositiveInteger(value);
  if (parsed === null) throw new ApiError(422, 'معرّف التصنيف أو الأولوية غير صالح');
  return parsed;
};

const isUniqueConflict = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export const addHoursUtc = (from: Date, hours: number): Date => new Date(from.getTime() + hours * MS_PER_HOUR);

export const calculateDueDates = (createdAt: Date, firstResponseHours: number, resolutionHours: number) => ({
  firstResponseDueAt: addHoursUtc(createdAt, firstResponseHours),
  dueAt: addHoursUtc(createdAt, resolutionHours),
});

export const computeSlaStatus = ({
  slaDueAt,
  status,
  now,
}: {
  slaDueAt: Date | null;
  status: string;
  now: Date;
}): SlaStatus => {
  if (!slaDueAt) return 'none';
  if ((TERMINAL_STATUSES as readonly string[]).includes(status)) return 'met';
  if (now.getTime() >= slaDueAt.getTime()) return 'overdue';
  return 'on_track';
};

export const computeEscalationLevel = ({
  slaDueAt,
  status,
  now,
  currentLevel,
  intervalHours,
  maxLevel,
}: {
  slaDueAt: Date | null;
  status: string;
  now: Date;
  currentLevel: number;
  intervalHours: number;
  maxLevel: number;
}): number => {
  if (!slaDueAt || (TERMINAL_STATUSES as readonly string[]).includes(status)) return currentLevel;
  if (now.getTime() < slaDueAt.getTime()) return currentLevel;
  const elapsed = now.getTime() - slaDueAt.getTime();
  const computed = 1 + Math.floor(elapsed / (intervalHours * MS_PER_HOUR));
  return Math.max(currentLevel, Math.min(maxLevel, computed));
};

const mapSlaRule = (rule: SlaRuleRecord) => ({
  id: rule.id,
  organizationId: rule.organization_id,
  name: rule.name,
  complaintType: rule.complaint_type,
  categoryItemId: rule.category_item_id,
  priorityItemId: rule.priority_item_id,
  isSensitive: rule.is_sensitive,
  firstResponseHours: rule.first_response_hours,
  resolutionHours: rule.resolution_hours,
  escalationIntervalHours: rule.escalation_interval_hours,
  maxEscalationLevel: rule.max_escalation_level,
  isActive: rule.is_active,
  createdAt: rule.created_at,
  updatedAt: rule.updated_at,
});

const assertHours = (firstResponseHours: number, resolutionHours: number, escalationIntervalHours: number) => {
  if (!Number.isInteger(firstResponseHours) || firstResponseHours < 1 || firstResponseHours > 8760) {
    throw new ApiError(422, 'ساعات الاستجابة الأولى غير صالحة');
  }
  if (!Number.isInteger(resolutionHours) || resolutionHours < 1 || resolutionHours > 8760) {
    throw new ApiError(422, 'ساعات الحل غير صالحة');
  }
  if (resolutionHours < firstResponseHours) {
    throw new ApiError(422, 'ساعات الحل يجب ألا تقل عن ساعات الاستجابة الأولى');
  }
  if (!Number.isInteger(escalationIntervalHours) || escalationIntervalHours < 1 || escalationIntervalHours > 8760) {
    throw new ApiError(422, 'فترة التصعيد بالساعات غير صالحة');
  }
};

const assertMaxLevel = (maxEscalationLevel: number) => {
  if (!Number.isInteger(maxEscalationLevel) || maxEscalationLevel < 1 || maxEscalationLevel > 10) {
    throw new ApiError(422, 'الحد الأقصى لمستوى التصعيد غير صالح');
  }
};

const matchKeyEquals = (
  left: { complaint_type: string | null; category_item_id: number | null; priority_item_id: number | null; is_sensitive: boolean | null },
  right: { complaintType: string | null; categoryItemId: number | null; priorityItemId: number | null; isSensitive: boolean | null }
) =>
  left.complaint_type === right.complaintType &&
  left.category_item_id === right.categoryItemId &&
  left.priority_item_id === right.priorityItemId &&
  left.is_sensitive === right.isSensitive;

const assertNoActiveMatchConflict = async (
  client: DatabaseClient,
  organizationId: number,
  match: { complaintType: string | null; categoryItemId: number | null; priorityItemId: number | null; isSensitive: boolean | null },
  excludeId?: number
) => {
  const existing = await client.sla_rules.findMany({
    where: { organization_id: organizationId, is_active: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, complaint_type: true, category_item_id: true, priority_item_id: true, is_sensitive: true },
  });
  if (existing.some((rule) => matchKeyEquals(rule, match))) {
    throw new ApiError(409, 'توجد قاعدة مهلة معالجة نشطة بنفس معايير المطابقة');
  }
};

const validateCategoryItem = async (client: DatabaseClient, organizationId: number, categoryItemId: number) => {
  const item = await client.reference_list_items.findFirst({
    where: {
      id: categoryItemId,
      is_active: true,
      reference_lists: {
        key: 'complaint_category',
        OR: [{ organization_id: null }, { organization_id: organizationId }],
      },
    },
    select: { id: true },
  });
  if (!item) throw new ApiError(422, 'تصنيف الشكوى غير صالح لهذه المؤسسة');
};

const validatePriorityItem = async (client: DatabaseClient, organizationId: number, priorityItemId: number) => {
  const item = await client.reference_list_items.findFirst({
    where: {
      id: priorityItemId,
      is_active: true,
      reference_lists: {
        key: 'complaint_priority',
        OR: [{ organization_id: null }, { organization_id: organizationId }],
      },
    },
    select: { id: true },
  });
  if (!item) throw new ApiError(422, 'أولوية الشكوى غير صالحة لهذه المؤسسة');
};

const normalizeMatchFields = async (
  client: DatabaseClient,
  organizationId: number,
  payload: {
    complaintType?: 'complaint' | 'proposal' | null;
    categoryItemId?: IdInput;
    priorityItemId?: IdInput;
    isSensitive?: boolean | null;
  }
) => {
  const complaintType = payload.complaintType === undefined ? null : payload.complaintType;
  const categoryItemId = payload.categoryItemId === undefined ? null : optionalNullableInt(payload.categoryItemId);
  const priorityItemId = payload.priorityItemId === undefined ? null : optionalNullableInt(payload.priorityItemId);
  const isSensitive = payload.isSensitive === undefined ? null : payload.isSensitive;
  if (categoryItemId) await validateCategoryItem(client, organizationId, categoryItemId);
  if (priorityItemId) await validatePriorityItem(client, organizationId, priorityItemId);
  return {
    complaintType: complaintType as 'complaint' | 'proposal' | null,
    categoryItemId: categoryItemId ?? null,
    priorityItemId: priorityItemId ?? null,
    isSensitive,
  };
};

const ruleMatchesComplaint = (rule: SlaRuleRecord, complaint: ComplaintSlaMatchInput): boolean => {
  if (rule.complaint_type && rule.complaint_type !== complaint.type) return false;
  if (rule.category_item_id !== null && rule.category_item_id !== complaint.categoryItemId) return false;
  if (rule.priority_item_id !== null && rule.priority_item_id !== (complaint.priorityItemId ?? null)) return false;
  if (rule.is_sensitive !== null && rule.is_sensitive !== complaint.isSensitive) return false;
  return true;
};

const specificity = (rule: SlaRuleRecord): number => {
  let score = 0;
  if (rule.complaint_type) score += 8;
  if (rule.category_item_id !== null) score += 4;
  if (rule.priority_item_id !== null) score += 2;
  if (rule.is_sensitive !== null) score += 1;
  return score;
};

export const matchSlaRule = async (
  client: DatabaseClient,
  organizationId: number,
  complaint: ComplaintSlaMatchInput
): Promise<SlaRuleRecord | null> => {
  const rules = await client.sla_rules.findMany({
    where: { organization_id: organizationId, is_active: true },
    select: SLA_RULE_SELECT,
    orderBy: { id: 'asc' },
  });
  const matches = rules.filter((rule) => ruleMatchesComplaint(rule, complaint));
  if (matches.length === 0) return null;
  return matches.reduce((best, rule) => {
    const bestScore = specificity(best);
    const score = specificity(rule);
    if (score > bestScore) return rule;
    if (score === bestScore && rule.id < best.id) return rule;
    return best;
  });
};

export const resolveComplaintSlaFields = async (
  client: DatabaseClient,
  organizationId: number,
  complaint: ComplaintSlaMatchInput
) => {
  const rule = await matchSlaRule(client, organizationId, complaint);
  if (!rule) {
    return {
      sla_rule_id: null,
      sla_due_at: null,
      sla_first_response_due_at: null,
      sla_first_responded_at: null,
      sla_status: 'none' as SlaStatus,
      escalation_level: 0,
      last_escalated_at: null,
    };
  }
  const due = calculateDueDates(complaint.createdAt, rule.first_response_hours, rule.resolution_hours);
  return {
    sla_rule_id: rule.id,
    sla_due_at: due.dueAt,
    sla_first_response_due_at: due.firstResponseDueAt,
    sla_first_responded_at: null,
    sla_status: 'on_track' as SlaStatus,
    escalation_level: 0,
    last_escalated_at: null,
  };
};

export const listSlaRules = async (organizationId: IdInput) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const rules = await prisma.sla_rules.findMany({
    where: { organization_id: parsedOrganizationId },
    select: SLA_RULE_SELECT,
    orderBy: [{ is_active: 'desc' }, { id: 'asc' }],
  });
  return rules.map(mapSlaRule);
};

export const createSlaRule = async (
  organizationId: IdInput,
  payload: SlaRulePayload,
  actorUserId: IdInput
) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const parsedActorUserId = toPositiveInteger(actorUserId);
  assertHours(payload.firstResponseHours, payload.resolutionHours, payload.escalationIntervalHours);
  const maxEscalationLevel = payload.maxEscalationLevel ?? DEFAULT_MAX_ESCALATION_LEVEL;
  assertMaxLevel(maxEscalationLevel);

  return prisma.$transaction(async (tx) => {
    const match = await normalizeMatchFields(tx, parsedOrganizationId, payload);
    await assertNoActiveMatchConflict(tx, parsedOrganizationId, match);
    const now = new Date();
    try {
      const created = await tx.sla_rules.create({
        data: {
          organization_id: parsedOrganizationId,
          name: payload.name.trim(),
          complaint_type: match.complaintType,
          category_item_id: match.categoryItemId,
          priority_item_id: match.priorityItemId,
          is_sensitive: match.isSensitive,
          first_response_hours: payload.firstResponseHours,
          resolution_hours: payload.resolutionHours,
          escalation_interval_hours: payload.escalationIntervalHours,
          max_escalation_level: maxEscalationLevel,
          is_active: payload.isActive !== false,
          created_at: now,
          updated_at: now,
        },
        select: SLA_RULE_SELECT,
      });
      await recordAuditEvent(tx, {
        organizationId: parsedOrganizationId,
        actorUserId: parsedActorUserId,
        action: 'sla_rule.created',
        entityType: 'sla_rule',
        entityId: created.id,
        metadata: {
          name: created.name,
          firstResponseHours: created.first_response_hours,
          resolutionHours: created.resolution_hours,
        },
      });
      return mapSlaRule(created);
    } catch (error) {
      if (isUniqueConflict(error)) throw new ApiError(409, 'توجد قاعدة مهلة معالجة نشطة بنفس معايير المطابقة');
      throw error;
    }
  });
};

export const updateSlaRule = async (
  organizationId: IdInput,
  id: IdInput,
  payload: SlaRuleUpdatePayload,
  actorUserId: IdInput
) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const parsedId = requireRuleId(id);
  const parsedActorUserId = toPositiveInteger(actorUserId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.sla_rules.findFirst({
      where: { id: parsedId, organization_id: parsedOrganizationId },
      select: SLA_RULE_SELECT,
    });
    if (!existing) throw new ApiError(404, 'قاعدة مهلة المعالجة غير موجودة');

    const firstResponseHours = payload.firstResponseHours ?? existing.first_response_hours;
    const resolutionHours = payload.resolutionHours ?? existing.resolution_hours;
    const escalationIntervalHours = payload.escalationIntervalHours ?? existing.escalation_interval_hours;
    const maxEscalationLevel = payload.maxEscalationLevel ?? existing.max_escalation_level;
    assertHours(firstResponseHours, resolutionHours, escalationIntervalHours);
    assertMaxLevel(maxEscalationLevel);

    const match = await normalizeMatchFields(tx, parsedOrganizationId, {
      complaintType: payload.complaintType === undefined ? existing.complaint_type : payload.complaintType,
      categoryItemId: payload.categoryItemId === undefined ? existing.category_item_id : payload.categoryItemId,
      priorityItemId: payload.priorityItemId === undefined ? existing.priority_item_id : payload.priorityItemId,
      isSensitive: payload.isSensitive === undefined ? existing.is_sensitive : payload.isSensitive,
    });
    const nextActive = payload.isActive ?? existing.is_active;
    if (nextActive) await assertNoActiveMatchConflict(tx, parsedOrganizationId, match, existing.id);

    try {
      const updated = await tx.sla_rules.update({
        where: { id: existing.id },
        data: {
          name: payload.name !== undefined ? payload.name.trim() : existing.name,
          complaint_type: match.complaintType,
          category_item_id: match.categoryItemId,
          priority_item_id: match.priorityItemId,
          is_sensitive: match.isSensitive,
          first_response_hours: firstResponseHours,
          resolution_hours: resolutionHours,
          escalation_interval_hours: escalationIntervalHours,
          max_escalation_level: maxEscalationLevel,
          is_active: nextActive,
          updated_at: new Date(),
        },
        select: SLA_RULE_SELECT,
      });
      await recordAuditEvent(tx, {
        organizationId: parsedOrganizationId,
        actorUserId: parsedActorUserId,
        action: 'sla_rule.updated',
        entityType: 'sla_rule',
        entityId: updated.id,
        metadata: {
          isActive: updated.is_active,
          firstResponseHours: updated.first_response_hours,
          resolutionHours: updated.resolution_hours,
        },
      });
      return mapSlaRule(updated);
    } catch (error) {
      if (isUniqueConflict(error)) throw new ApiError(409, 'توجد قاعدة مهلة معالجة نشطة بنفس معايير المطابقة');
      throw error;
    }
  });
};

const notifyEscalation = async (
  client: DatabaseClient,
  organizationId: number,
  complaint: {
    id: number;
    assigned_to_user_id: number | null;
    assigned_to_org_unit_id: number | null;
  },
  toLevel: number,
  reason: EscalationReason
) => {
  let userId = complaint.assigned_to_user_id;
  if (userId === null && complaint.assigned_to_org_unit_id !== null) {
    const orgUnit = await client.org_units.findFirst({
      where: {
        id: complaint.assigned_to_org_unit_id,
        organization_id: organizationId,
        is_active: true,
        deleted_at: null,
      },
      select: { manager_user_id: true },
    });
    if (orgUnit?.manager_user_id) {
      const manager = await client.users.findFirst({
        where: {
          id: orgUnit.manager_user_id,
          is_active: true,
          user_organizations: { some: { organization_id: organizationId, is_active: true } },
        },
        select: { id: true },
      });
      if (manager) userId = manager.id;
    }
  }
  if (userId === null) return;
  await createNotification(client, {
    organizationId,
    userId,
    notificationType: 'complaint.escalated',
    title: 'تصعيد شكوى',
    message: `تم تصعيد الشكوى إلى المستوى ${toLevel}`,
    entityType: 'complaint',
    entityId: complaint.id,
    metadata: { escalationLevel: toLevel, reason },
  });
};

const persistEscalation = async (
  client: DatabaseClient,
  organizationId: number,
  complaint: {
    id: number;
    sla_rule_id: number | null;
    assigned_to_user_id: number | null;
    assigned_to_org_unit_id: number | null;
  },
  fromLevel: number,
  toLevel: number,
  reason: EscalationReason,
  note: string | null,
  actorUserId: number | null,
  slaStatus: SlaStatus,
  now: Date
) => {
  const updated = await client.complaints.updateMany({
    where: {
      id: complaint.id,
      organization_id: organizationId,
      escalation_level: { lt: toLevel },
    },
    data: {
      escalation_level: toLevel,
      last_escalated_at: now,
      sla_status: slaStatus,
      updated_at: now,
    },
  });
  if (updated.count === 0) return;
  await client.complaint_escalation_events.create({
    data: {
      organization_id: organizationId,
      complaint_id: complaint.id,
      sla_rule_id: complaint.sla_rule_id,
      from_level: fromLevel,
      to_level: toLevel,
      reason,
      note,
      triggered_by_user_id: actorUserId,
      created_at: now,
    },
  });
  await recordAuditEvent(client, {
    organizationId,
    actorUserId,
    action: 'complaint.escalated',
    entityType: 'complaint',
    entityId: complaint.id,
    metadata: { fromLevel, toLevel, reason },
  });
  await notifyEscalation(client, organizationId, complaint, toLevel, reason);
};

export const evaluateOrganizationSla = async (
  organizationId: IdInput,
  options: { now?: Date; actorUserId?: IdInput } = {}
) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const now = options.now || new Date();
  const actorUserId = toPositiveInteger(options.actorUserId);

  return prisma.$transaction(async (tx) => {
    const complaints = await tx.complaints.findMany({
      where: {
        organization_id: parsedOrganizationId,
        status: { in: [...OPEN_STATUSES] },
        sla_due_at: { not: null },
      },
      select: {
        id: true,
        status: true,
        sla_rule_id: true,
        sla_due_at: true,
        sla_status: true,
        escalation_level: true,
        assigned_to_user_id: true,
        assigned_to_org_unit_id: true,
        sla_rules: {
          select: { escalation_interval_hours: true, max_escalation_level: true },
        },
      },
    });

    let overdue = 0;
    let escalated = 0;
    const results: Array<{ id: number; slaStatus: SlaStatus; escalationLevel: number }> = [];

    for (const complaint of complaints) {
      const slaStatus = computeSlaStatus({ slaDueAt: complaint.sla_due_at, status: complaint.status, now });
      if (slaStatus === 'overdue') overdue += 1;
      const intervalHours = complaint.sla_rules?.escalation_interval_hours ?? 24;
      const maxLevel = complaint.sla_rules?.max_escalation_level ?? DEFAULT_MAX_ESCALATION_LEVEL;
      const nextLevel = computeEscalationLevel({
        slaDueAt: complaint.sla_due_at,
        status: complaint.status,
        now,
        currentLevel: complaint.escalation_level,
        intervalHours,
        maxLevel,
      });

      if (nextLevel > complaint.escalation_level) {
        await persistEscalation(
          tx,
          parsedOrganizationId,
          complaint,
          complaint.escalation_level,
          nextLevel,
          'overdue',
          null,
          actorUserId,
          slaStatus,
          now
        );
        escalated += 1;
        results.push({ id: complaint.id, slaStatus, escalationLevel: nextLevel });
        continue;
      }

      if (complaint.sla_status !== slaStatus) {
        await tx.complaints.updateMany({
          where: { id: complaint.id, organization_id: parsedOrganizationId },
          data: { sla_status: slaStatus, updated_at: now },
        });
        if (slaStatus === 'overdue') {
          await recordAuditEvent(tx, {
            organizationId: parsedOrganizationId,
            actorUserId,
            action: 'complaint.sla_overdue',
            entityType: 'complaint',
            entityId: complaint.id,
            metadata: { slaStatus, escalationLevel: complaint.escalation_level },
          });
        }
      }
      results.push({ id: complaint.id, slaStatus, escalationLevel: complaint.escalation_level });
    }

    return { evaluated: complaints.length, overdue, escalated, complaints: results };
  });
};

export const escalateComplaint = async (
  organizationId: IdInput,
  id: IdInput,
  payload: { note?: string | null } = {},
  actorUserId: IdInput
) => {
  const parsedOrganizationId = requireOrganizationId(organizationId);
  const parsedId = requireComplaintId(id);
  const parsedActorUserId = toPositiveInteger(actorUserId);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const complaint = await tx.complaints.findFirst({
      where: { id: parsedId, organization_id: parsedOrganizationId },
      select: {
        id: true,
        status: true,
        sla_rule_id: true,
        sla_due_at: true,
        sla_status: true,
        escalation_level: true,
        assigned_to_user_id: true,
        assigned_to_org_unit_id: true,
        sla_rules: { select: { max_escalation_level: true } },
      },
    });
    if (!complaint) throw new ApiError(404, 'الطلب غير موجود');
    if ((TERMINAL_STATUSES as readonly string[]).includes(complaint.status)) {
      throw new ApiError(409, 'لا يمكن تصعيد طلب مغلق');
    }

    const maxLevel = complaint.sla_rules?.max_escalation_level ?? DEFAULT_MAX_ESCALATION_LEVEL;
    const nextLevel = complaint.escalation_level + 1;
    if (nextLevel > maxLevel) throw new ApiError(409, 'بلغت الشكوى الحد الأقصى لمستوى التصعيد');

    const slaStatus = computeSlaStatus({ slaDueAt: complaint.sla_due_at, status: complaint.status, now });
    await persistEscalation(
      tx,
      parsedOrganizationId,
      complaint,
      complaint.escalation_level,
      nextLevel,
      'manual',
      payload.note || null,
      parsedActorUserId,
      slaStatus,
      now
    );

    return {
      id: complaint.id,
      slaStatus,
      escalationLevel: nextLevel,
    };
  });
};

export const slaStatusForStatusChange = ({
  previousStatus,
  nextStatus,
  slaDueAt,
  slaFirstRespondedAt,
  now,
}: {
  previousStatus: string;
  nextStatus: string;
  slaDueAt: Date | null;
  slaFirstRespondedAt: Date | null;
  now: Date;
}) => {
  const firstRespondedAt =
    slaFirstRespondedAt || (previousStatus === 'new' && nextStatus !== 'new' ? now : slaFirstRespondedAt);
  return {
    sla_first_responded_at: firstRespondedAt,
    sla_status: computeSlaStatus({ slaDueAt, status: nextStatus, now }),
  };
};

export const evaluateAllOrganizationsSla = async (options: { now?: Date; actorUserId?: IdInput } = {}) => {
  const activeOrganizations = await prisma.organizations.findMany({
    where: { is_active: true },
    select: { id: true },
  });

  let totalEvaluated = 0;
  let totalOverdue = 0;
  let totalEscalated = 0;

  for (const org of activeOrganizations) {
    const res = await evaluateOrganizationSla(org.id, options);
    totalEvaluated += res.evaluated;
    totalOverdue += res.overdue;
    totalEscalated += res.escalated;
  }

  return {
    organizationsEvaluated: activeOrganizations.length,
    evaluated: totalEvaluated,
    overdue: totalOverdue,
    escalated: totalEscalated,
  };
};
