import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ForbiddenState } from './AdminUi';

interface PermissionGateProps {
  /** Single required permission. Ignored when `anyPermission` is provided. */
  permission?: string;
  /** Alternative permissions: access is granted when the user holds at least one of them. */
  anyPermission?: string[];
  children: ReactNode;
  title?: string;
}

/** UX guard only; backend authorization remains authoritative. */
export default function PermissionGate({ permission, anyPermission = [], children, title }: PermissionGateProps) {
  const { user, hasPermission, currentOrganizationId } = useAuth();
  const organizationId = currentOrganizationId ?? user?.defaultOrganizationId ?? null;

  if (!user || organizationId === null || organizationId === undefined) return <ForbiddenState title={title} permission={permission} />;

  const isAuthorized = anyPermission.length > 0
    ? anyPermission.some((permissionCode) => hasPermission(permissionCode, organizationId))
    : permission !== undefined && hasPermission(permission, organizationId);

  if (!isAuthorized) {
    return <ForbiddenState title={title} permission={permission ?? (anyPermission.length > 0 ? anyPermission.join(' / ') : undefined)} />;
  }
  return <>{children}</>;
}

export function AdminRoleGate({ children, title = 'الوصول إلى سجل التدقيق غير مسموح' }: { children: ReactNode; title?: string }) {
  const { user } = useAuth();
  if (!user?.roleCodes.includes('admin')) return <ForbiddenState title={title} />;
  return <>{children}</>;
}

interface PlatformPermissionGateProps {
  permission?: string;
  anyPermission?: string[];
  children: ReactNode;
  title?: string;
}

/** UX guard for platform scope; backend platform authorization remains authoritative. */
export function PlatformPermissionGate({ permission, anyPermission = [], children, title }: PlatformPermissionGateProps) {
  const { user, hasPlatformPermission } = useAuth();
  const isAuthorized = permission
    ? hasPlatformPermission(permission)
    : anyPermission.some((permissionCode) => hasPlatformPermission(permissionCode));

  if (!user || !isAuthorized) return <ForbiddenState title={title} />;
  return <>{children}</>;
}
