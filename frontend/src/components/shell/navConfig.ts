import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  MessageSquareWarning,
  Users,
  ShieldCheck,
  Building2,
  Network,
  Database,
  Timer,
  ScrollText,
  Bell,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** NavLink end-matching (Dashboard must not match every /admin/* route). */
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Grouped admin navigation — single source for Sidebar, MobileNav and
 * CommandMenu. Visibility intentionally matches current behaviour: pages
 * enforce their own authorization via PermissionGate; nav gating must not
 * invent new authorization rules.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'العمليات',
    items: [
      { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
      { to: '/admin/complaints', label: 'الشكاوى', icon: MessageSquareWarning },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { to: '/admin/users', label: 'المستخدمون', icon: Users },
      { to: '/admin/roles', label: 'الأدوار والصلاحيات', icon: ShieldCheck },
      { to: '/admin/organization', label: 'المؤسسة', icon: Building2 },
      { to: '/admin/org-structure', label: 'الهيكل التنظيمي', icon: Network },
      { to: '/admin/reference-data', label: 'البيانات المرجعية', icon: Database },
      { to: '/admin/sla', label: 'قواعد SLA', icon: Timer },
    ],
  },
  {
    label: 'الرقابة',
    items: [
      { to: '/admin/audit-logs', label: 'سجل التدقيق', icon: ScrollText },
      { to: '/admin/notifications', label: 'الإشعارات', icon: Bell },
    ],
  },
];
