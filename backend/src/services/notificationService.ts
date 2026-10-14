import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import ApiError from '../utils/ApiError';

type NotificationClient = typeof prisma | Prisma.TransactionClient;

export interface NotificationEvent {
  organizationId: number;
  userId: number;
  notificationType: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Prisma.InputJsonValue | null;
  idempotencyKey?: string | null;
}

export interface NotificationFilters {
  page?: string | number;
  limit?: string | number;
  unreadOnly?: string | boolean;
}

const toPositiveInteger = (value: string | number | undefined): number | null => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const createNotification = async (client: NotificationClient, event: NotificationEvent): Promise<void> => {
  const data = {
      organization_id: event.organizationId,
      user_id: event.userId,
      notification_type: event.notificationType,
      idempotency_key: event.idempotencyKey ?? null,
      title: event.title,
      message: event.message,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      metadata: event.metadata ?? undefined,
      created_at: new Date(),
  };

  if (event.idempotencyKey) {
    await client.notifications.upsert({
      where: { idempotency_key: event.idempotencyKey },
      create: data,
      update: {},
    });
    return;
  }

  await client.notifications.create({ data });
};

export interface NotificationOutboxEvent extends NotificationEvent {
  complaintId: number;
  idempotencyKey: string;
}

const OUTBOX_MAX_ATTEMPTS = 5;
const OUTBOX_LEASE_MS = 2 * 60 * 1000;

const retryDelayMs = (attemptCount: number): number =>
  Math.min(60 * 60 * 1000, 1000 * (2 ** Math.max(0, attemptCount - 1)));

const errorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 2000);
};

export const enqueueNotificationOutbox = async (
  client: NotificationClient,
  event: NotificationOutboxEvent
): Promise<void> => {
  await client.notification_outbox.upsert({
    where: { idempotency_key: event.idempotencyKey },
    create: {
      organization_id: event.organizationId,
      complaint_id: event.complaintId,
      recipient_user_id: event.userId,
      idempotency_key: event.idempotencyKey,
      notification_type: event.notificationType,
      title: event.title,
      message: event.message,
      metadata: event.metadata ?? undefined,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    },
    update: {},
  });
};

const claimNextNotificationOutbox = async () => prisma.$transaction(async (tx) => {
  const now = new Date();
  const claimable = {
    OR: [
      { status: 'pending', next_attempt_at: { lte: now } },
      { status: 'processing', locked_until: { lte: now }, attempt_count: { lt: OUTBOX_MAX_ATTEMPTS } },
    ],
  };
  const row = await tx.notification_outbox.findFirst({
    where: claimable,
    orderBy: { id: 'asc' },
  });
  if (!row) return null;

  const claimed = await tx.notification_outbox.updateMany({
    where: { id: row.id, ...claimable },
    data: {
      status: 'processing',
      attempt_count: { increment: 1 },
      locked_until: new Date(now.getTime() + OUTBOX_LEASE_MS),
      updated_at: now,
    },
  });
  if (claimed.count !== 1) return null;
  return tx.notification_outbox.findUnique({ where: { id: row.id } });
});

export type NotificationOutboxProcessResult = 'idle' | 'delivered' | 'retry' | 'failed';

export const processNextNotificationOutbox = async (): Promise<NotificationOutboxProcessResult> => {
  const row = await claimNextNotificationOutbox();
  if (!row) return 'idle';

  try {
    await createNotification(prisma, {
      organizationId: row.organization_id,
      userId: row.recipient_user_id,
      notificationType: row.notification_type,
      title: row.title,
      message: row.message,
      entityType: 'complaint',
      entityId: row.complaint_id,
      metadata: row.metadata as Prisma.InputJsonValue | null,
      idempotencyKey: row.idempotency_key,
    });
    await prisma.notification_outbox.updateMany({
      where: { id: row.id, status: 'processing' },
      data: {
        status: 'delivered',
        locked_until: null,
        delivered_at: new Date(),
        updated_at: new Date(),
      },
    });
    return 'delivered';
  } catch (error) {
    const exhausted = row.attempt_count >= OUTBOX_MAX_ATTEMPTS;
    const now = new Date();
    await prisma.notification_outbox.updateMany({
      where: { id: row.id, status: 'processing' },
      data: {
        status: exhausted ? 'failed' : 'pending',
        next_attempt_at: new Date(now.getTime() + retryDelayMs(row.attempt_count)),
        locked_until: null,
        last_error: errorMessage(error),
        updated_at: now,
      },
    });
    console.error(`[Notification Outbox] ${exhausted ? 'Permanently failed' : 'Delivery failed'} for ${row.idempotency_key}:`, errorMessage(error));
    return exhausted ? 'failed' : 'retry';
  }
};

export const processNotificationOutboxBatch = async (limit = 25): Promise<number> => {
  let processed = 0;
  while (processed < limit) {
    const result = await processNextNotificationOutbox();
    if (result === 'idle') break;
    processed += 1;
  }
  return processed;
};

export const listNotifications = async (userId: number, organizationId: number, filters: NotificationFilters = {}) => {
  const page = Math.max(1, Number.parseInt(String(filters.page || ''), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(filters.limit || ''), 10) || 25));
  const unreadOnly = filters.unreadOnly === true || filters.unreadOnly === 'true';
  const where: Prisma.notificationsWhereInput = {
    user_id: userId,
    organization_id: organizationId,
    ...(unreadOnly ? { read_at: null } : {}),
  };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notifications.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.notifications.count({ where }),
    prisma.notifications.count({ where: { user_id: userId, organization_id: organizationId, read_at: null } }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      type: row.notification_type,
      title: row.title,
      message: row.message,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unreadCount,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const markNotificationRead = async (userId: number, organizationId: number, notificationId: string | number) => {
  const parsedId = toPositiveInteger(notificationId);
  if (parsedId === null) throw new ApiError(404, 'الإشعار غير موجود');
  const updated = await prisma.notifications.updateMany({
    where: { id: parsedId, user_id: userId, organization_id: organizationId },
    data: { read_at: new Date() },
  });
  if (updated.count !== 1) throw new ApiError(404, 'الإشعار غير موجود');
};
