import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchNotifications, markNotificationRead, type Notification } from '../../api/adminApi';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../utils/dateTime';

const POLL_INTERVAL_MS = 60_000;

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadNotifications = useCallback(() => {
    fetchNotifications({ limit: 20 })
      .then((result) => {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      })
      .catch(() => {
        // Silently fail polling — avoid user-facing error for background refresh
      });
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Mark-read failure is non-critical
      }
    }
    setIsOpen(false);

    if (notification.entityType === 'complaint' && notification.entityId) {
      navigate(`/admin/complaints/${notification.entityId}`);
    }
  };

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button
        className="notification-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-label={`الإشعارات${unreadCount > 0 ? ` (${unreadCount} غير مقروءة)` : ''}`}
      >
        <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown__header">
            <h3>الإشعارات</h3>
          </div>

          <div className="notification-dropdown__list">
            {notifications.length === 0 ? (
              <div className="notification-dropdown__empty">
                لا توجد إشعارات
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notification-item ${!n.readAt ? 'notification-item--unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                  type="button"
                >
                  <div className="notification-item__title">{n.title}</div>
                  <div className="notification-item__message">{n.message}</div>
                  <div className="notification-item__time">
                    {formatDateTime(n.createdAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
