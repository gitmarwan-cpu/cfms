import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationCenter from './NotificationCenter';
import { useState } from 'react';

const NAV_ITEMS = [
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
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path: string, exact: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

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
            {NAV_ITEMS.map((item) => (
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
          <div className="admin-header__actions">
            <NotificationCenter />
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
