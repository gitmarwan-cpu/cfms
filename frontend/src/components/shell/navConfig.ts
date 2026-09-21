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
import type { AuthUser } from '../../api/authApi';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** NavLink end-matching (Dashboard must not match every /admin/* route). */
  end?: boolean;
  /** Platform-scoped visibility check; tenant items remain unchanged. */
  platformPermission?: string;
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
  {
    label: 'إدارة المنصة',
    items: [
      { to: '/admin/platform/users', label: 'مستخدمو المنصة', icon: Users, platformPermission: 'platform.users.manage' },
      { to: '/admin/platform/tenants', label: 'دليل المستأجرين', icon: Building2, platformPermission: 'platform.tenant.lifecycle' },
      { to: '/admin/platform/tenants/new', label: 'تهيئة مستأجر', icon: Building2, platformPermission: 'platform.tenant.create' },
      { to: '/admin/platform/tenants', label: 'دورة حياة المستأجرين', icon: Timer, platformPermission: 'platform.tenant.lifecycle' },
      { to: '/admin/platform/memberships-roles', label: 'العضويات والأدوار', icon: ShieldCheck, platformPermission: 'platform.memberships.manage' },
    ],
  },
];

export const getVisibleNavGroups = (user: AuthUser | null): NavGroup[] =>
  // Tenant navigation is meaningful only when /auth/me confirms at least one
  // active tenant membership. Platform permissions alone do not imply tenant access.
  (user?.organizations?.length ? NAV_GROUPS : NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.platformPermission),
  })))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        !item.platformPermission || user?.platformPermissions.includes(item.platformPermission)
      ),
    }))
    .filter((group) => group.items.length > 0);
