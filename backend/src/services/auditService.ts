import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';

type AuditClient = typeof prisma | Prisma.TransactionClient;

export interface AuditEvent {
  organizationId?: number | null;
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface AuditLogFilters {
  page?: string | number;
  limit?: string | number;
  entityType?: string;
  entityId?: string | number;
}

const toPositiveInteger = (value: string | number | undefined): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const recordAuditEvent = async (client: AuditClient, event: AuditEvent): Promise<void> => {
  await client.audit_logs.create({
    data: {
      organization_id: event.organizationId ?? null,
      actor_user_id: event.actorUserId ?? null,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      metadata: event.metadata ?? undefined,
      created_at: new Date(),
    },
  });
};

export const listAuditLogs = async (organizationId: number, filters: AuditLogFilters = {}) => {
  const page = Math.max(1, Number.parseInt(String(filters.page || ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit || ''), 10) || 50));
  const entityId = toPositiveInteger(filters.entityId);
  const where: Prisma.audit_logsWhereInput = { organization_id: organizationId };
  if (filters.entityType) where.entity_type = filters.entityType;
  if (filters.entityId !== undefined) where.entity_id = entityId;

  const [rows, total] = await Promise.all([
    prisma.audit_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        organization_id: true,
        actor_user_id: true,
        action: true,
        entity_type: true,
        entity_id: true,
        metadata: true,
        created_at: true,
        users: { select: { id: true, full_name: true, email: true } },
      },
    }),
    prisma.audit_logs.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      actorUserId: row.actor_user_id,
      actor: row.users
        ? { id: row.users.id, fullName: row.users.full_name, email: row.users.email }
        : null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    })),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};
