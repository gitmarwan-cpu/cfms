import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  markNotificationRead,
  type Notification,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { DataState } from '../../components/admin/AdminUi';
import { NotificationItem } from '../../components/patterns/NotificationItem';
import { PageHeader } from '../../components/patterns/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    fetchNotifications({ limit: 100 })
      .then((result) => {
        setItems(result.notifications);
        setUnread(result.unreadCount);
      })
      .catch((err: ApiClientError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const open = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id);
        setItems((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
          )
        );
        setUnread((count) => Math.max(0, count - 1));
      } catch {
        // Mark-read failure is non-critical.
      }
    }
    if (notification.entityType === 'complaint' && notification.entityId) {
      navigate(`/admin/complaints/${notification.entityId}`);
    }
  };

  return (
    <>
      <PageHeader
        title="الإشعارات"
        description={unread ? `${unread} إشعار غير مقروء` : 'لا توجد إشعارات غير مقروءة'}
        actions={unread > 0 ? <StatusBadge tone="info">غير مقروءة: {unread}</StatusBadge> : undefined}
      />
      <DataState loading={loading} error={error} empty={!items.length} onRetry={load}>
        <div className="ntf-list" role="list" aria-label="الإشعارات">
          {items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onOpen={open} />
          ))}
        </div>
      </DataState>
    </>
  );
}
