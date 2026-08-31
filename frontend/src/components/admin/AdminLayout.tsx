import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationCenter from './NotificationCenter';
import OrganizationSwitcher from './OrganizationSwitcher';
import ChangePasswordDialog from './ChangePasswordDialog';
import { useEffect, useRef, useState } from 'react';

type NavItem = { path: string; label: string; icon: string; exact: boolean; permission?: string; adminOnly?: boolean };

const NAV_ITEMS: NavItem[] = [
  {
    path: '/admin',
    label: 'الرئيسية',
    icon: '📊',
    exact: true,
  },
  {
    path: '/admin/complaints',
    label: 'صندوق الشكاوى',
    icon: '📥',
    exact: false,
    permission: 'complaints.view_all',
  },
  { path: '/admin/notifications', label: 'الإشعارات', icon: '🔔', exact: false },
  { path: '/admin/organization', label: 'المؤسسة', icon: '🏢', exact: false, permission: 'organization.view' },
  { path: '/admin/roles', label: 'الأدوار والصلاحيات', icon: '🛡️', exact: false, permission: 'roles.view' },
  { path: '/admin/users', label: 'المستخدمون', icon: '👤', exact: false, permission: 'users.view' },
  { path: '/admin/org-structure', label: 'الهيكل التنظيمي', icon: '▦', exact: false, permission: 'org_structure.view' },
  { path: '/admin/reference-data', label: 'البيانات المرجعية', icon: '☷', exact: false, permission: 'reference_data.view' },
  { path: '/admin/sla', label: 'SLA', icon: '⏱', exact: false, permission: 'organization.view' },
  { path: '/admin/audit', label: 'سجل التدقيق', icon: '◷', exact: false, adminOnly: true },
];

export default function AdminLayout() {
  const { user, logout, currentOrganizationId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path: string, exact: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const canSee = (item: NavItem) => {
    if (item.adminOnly) return user?.roleCodes.includes('admin') || false;
    if (!item.permission) return true;
    return user?.permissions?.some(
      (permission) => permission.code === item.permission && permission.organizationId === currentOrganizationId
    ) || false;
  };

  const currentItem = NAV_ITEMS.find((item) => isActive(item.path, item.exact));

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar__brand">
          <h2>لوحة التحكم</h2>
          <p>CFMS</p>
        </div>

        <nav className="admin-sidebar__nav">
          <ul>
            {NAV_ITEMS.filter(canSee).map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`admin-nav-link ${isActive(item.path, item.exact) ? 'admin-nav-link--active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__user">
            <div className="admin-sidebar__user-name">{user?.fullName}</div>
            <div className="admin-sidebar__user-email">{user?.email}</div>
          </div>
          <button
            className="admin-sidebar__logout"
            onClick={handleLogout}
            type="button"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-content">
        {/* Top Header */}
        <header className="admin-header">
          <button
            className="admin-header__menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            type="button"
            aria-label="القائمة"
          >
            ☰
          </button>
          <div className="admin-header__breadcrumb" aria-label="مسار الصفحة">
            <span>لوحة التحكم</span>
            {currentItem && <><span aria-hidden="true">/</span><strong>{currentItem.label}</strong></>}
          </div>
          <div className="admin-header__actions">
            <OrganizationSwitcher />
            <NotificationCenter />
            <AccountMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── Account Menu ───────────────────────────────────────────────────────────────

/** Header account menu — hosts the self-service "change my password" entry. */
function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-outline"
        style={{ fontSize: '13px', padding: '6px 12px' }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        الحساب ▾
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            minWidth: '180px',
            zIndex: 60,
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="admin-text-button"
            style={{ display: 'block', width: '100%', textAlign: 'right', padding: '10px 14px' }}
            onClick={() => {
              setOpen(false);
              setChangeOpen(true);
            }}
          >
            تغيير كلمة المرور
          </button>
        </div>
      )}
      {changeOpen && <ChangePasswordDialog onClose={() => setChangeOpen(false)} />}
    </div>
  );
}
