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
  await client.notifications.create({
    data: {
      organization_id: event.organizationId,
      user_id: event.userId,
      notification_type: event.notificationType,
      title: event.title,
      message: event.message,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      metadata: event.metadata ?? undefined,
      created_at: new Date(),
    },
  });
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
