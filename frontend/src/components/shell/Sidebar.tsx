import { NavLink } from 'react-router-dom';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { NAV_GROUPS } from './navConfig';
import { cn } from '../../utils/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/** Desktop sidebar: grouped navigation, active state, collapsible rail. */
export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside className={cn('sidebar', collapsed && 'sidebar--collapsed')} aria-label="التنقل الرئيسي">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true">C</span>
        <span className="sidebar__brand-name">نظام الشكاوى</span>
      </div>
      <nav className="sidebar__nav" aria-label="أقسام لوحة الإدارة">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div className="sidebar__group" key={group.label}>
            <div className="sidebar__group-label" id={`sidebar-group-${groupIndex}`}>
              {group.label}
            </div>
            <ul className="sidebar__group-list" aria-labelledby={`sidebar-group-${groupIndex}`}>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => cn('sidebar__link', isActive && 'sidebar__link--active')}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="sidebar__link-icon" aria-hidden="true">
                      <item.icon size={18} />
                    </span>
                    <span className="sidebar__link-text">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <button
        type="button"
        className="sidebar__collapse-btn"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'تصغير القائمة الجانبية'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
      </button>
    </aside>
  );
}
