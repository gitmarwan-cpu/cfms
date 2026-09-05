import { Bell, Building2, ClipboardList, Timer, Users, type LucideIcon } from 'lucide-react';
import type { Notification } from '../../api/adminApi';
import { cn } from '../../utils/cn';
import { formatDateTime } from '../../utils/dateTime';

const TYPE_ICONS: Record<string, LucideIcon> = {
  complaint: ClipboardList,
  membership: Users,
  sla: Timer,
  organization: Building2,
};

function iconForType(type: string): LucideIcon {
  const prefix = type.split('.')[0] ?? '';
  return TYPE_ICONS[prefix] ?? Bell;
}

export interface NotificationItemProps {
  notification: Notification;
  onOpen: (notification: Notification) => void;
  /** Compact layout for dropdown/popover contexts (header notification center). */
  compact?: boolean;
}

/**
 * Single notification row — the ONE implementation used by both the
 * header notification center and the Notifications page.
 * Unread state is always communicated by icon + text + accent, never by color alone.
 */
export function NotificationItem({ notification, onOpen, compact = false }: NotificationItemProps) {
  const Icon = iconForType(notification.type ?? '');
  const unread = !notification.readAt;
  return (
    <button
      type="button"
      className={cn('ntf-item', unread && 'ntf-item--unread', compact && 'ntf-item--compact')}
      onClick={() => onOpen(notification)}
      aria-label={unread ? `إشعار غير مقروء: ${notification.title}` : notification.title}
    >
      <span className="ntf-item__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="ntf-item__body">
        <span className="ntf-item__title">{notification.title}</span>
        <span className="ntf-item__message">{notification.message}</span>
        <time className="ntf-item__time" dateTime={notification.createdAt}>
          {formatDateTime(notification.createdAt)}
        </time>
      </span>
      {unread && <span className="ntf-item__dot" aria-hidden="true" />}
    </button>
  );
}

export default NotificationItem;