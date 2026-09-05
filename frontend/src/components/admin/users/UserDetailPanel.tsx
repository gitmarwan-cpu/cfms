import { X } from 'lucide-react';
import { StatusBadge } from '../../ui/StatusBadge';
import { LoadingSkeleton } from '../AdminUi';
import { type Role } from '../../../api/adminApi';
import { type ManagedUser, type Membership, type UserRoleAssignment } from '../../../api/usersApi';
import AuditMetadata from '../AuditMetadata';
import UserRolesPanel from './UserRolesPanel';
import { UserMembershipsPanel } from "./UserMembershipsPanel";

interface UserDetailPanelProps {
  user: ManagedUser;
  roles: Role[];
  userRoles: UserRoleAssignment[];
  memberships: Membership[];
  accessLoading: boolean;
  accessError: string;
  busy: boolean;
  busyAssignmentId: number | null;
  busyMembershipId: number | null;
  canManage: boolean;
  /** Active tenant context name (passed through to the memberships panel). */
  organizationName?: string;
  onEdit: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
  onClose: () => void;
  onAssignRole: (roleId: number) => void;
  onRevokeRole: (assignmentId: number) => void;
  onAddMembership: () => void;
  onRemoveMembership: (membershipId: number) => void;
  onSetPrimary: (membershipId: number) => void;
  onResetPassword: () => void;
}

function UserDetailPanel({
  user,
  roles,
  userRoles,
  memberships,
  accessLoading,
  accessError,
  busy,
  busyAssignmentId,
  busyMembershipId,
  canManage,
  organizationName,
  onEdit,
  onDeactivate,
  onActivate,
  onClose,
  onAssignRole,
  onRevokeRole,
  onAddMembership,
  onRemoveMembership,
  onSetPrimary,
  onResetPassword,
}: UserDetailPanelProps) {
  return (
    <div>
      {/* Header bar: name, status, actions */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <div
          className="card__header"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}
        >
          <div>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 2px' }}>{user.fullName}</h2>
            <span dir="ltr" style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{user.email}</span>
          </div>
          <span className="admin-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'نشط' : 'معطّل'}</StatusBadge>
            {canManage && (
              <>
                <button type="button" className="btn btn-outline" style={{ fontSize: '13px' }} onClick={onEdit}>
                  تعديل
                </button>
                <button type="button" className="btn btn-outline" style={{ fontSize: '13px' }} onClick={onResetPassword} disabled={busy}>
                  إعادة تعيين كلمة المرور
                </button>
                {user.isActive ? (
                  <button type="button" className="btn btn-outline" style={{ fontSize: '13px', color: 'var(--color-danger, #c0392b)' }} onClick={onDeactivate} disabled={busy}>
                    إلغاء التفعيل
                  </button>
                ) : (
                  <button type="button" className="btn btn-outline" style={{ fontSize: '13px' }} onClick={onActivate} disabled={busy}>
                    {busy ? '…' : 'تفعيل'}
                  </button>
                )}
              </>
            )}
            <button type="button" className="btn btn-outline" style={{ fontSize: '13px' }} onClick={onClose} aria-label="إغلاق لوحة التفاصيل">
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>

      {accessError && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: '12px' }}>
          {accessError}
        </div>
      )}

      {/* Two-column grid: Info + Memberships side by side, Roles full-width below */}
      {accessLoading ? (
        <div className="admin-detail-grid">
          <div className="card">
            <div className="card__header"><LoadingSkeleton rows={1} /></div>
            <div className="card__body"><LoadingSkeleton rows={3} /></div>
          </div>
          <div className="card">
            <div className="card__header"><LoadingSkeleton rows={1} /></div>
            <div className="card__body"><LoadingSkeleton rows={3} /></div>
          </div>
        </div>
      ) : (
        <div className="admin-detail-grid">
          {/* Left column: basic user info */}
          <div className="card">
            <div className="card__header">
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>معلومات المستخدم</h3>
            </div>
            <div className="card__body">
              <div className="admin-detail-fields">
                <div>
                  <span className="admin-detail-label">البريد الإلكتروني</span>
                  <span className="admin-detail-value" dir="ltr" style={{ display: 'inline-block' }}>{user.email}</span>
                </div>
                {user.primaryOrganizationNode ? (
                  <div>
                    <span className="admin-detail-label">العقدة التنظيمية</span>
                    <span className="admin-detail-value">
                      {user.primaryOrganizationNode.legalName}
                      {user.primaryOrganizationNode.code && (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginInlineEnd: '6px' }}>
                          ({user.primaryOrganizationNode.code})
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="admin-detail-label">العقدة التنظيمية</span>
                    <span className="admin-detail-value" style={{ color: 'var(--color-text-muted)' }}>غير محددة</span>
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
                <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px', color: 'var(--color-text-muted)' }}>معلومات السجل</h3>
                <AuditMetadata createdAt={user.createdAt} updatedAt={user.updatedAt} />
              </div>
            </div>
          </div>

          {/* Right column: memberships */}
          <UserMembershipsPanel
            key={`memberships-${user.id}`}
            memberships={memberships}
            busy={busy}
            busyMembershipId={busyMembershipId}
            canManage={canManage}
            organizationName={organizationName}
            onAdd={onAddMembership}
            onRemove={onRemoveMembership}
            onSetPrimary={onSetPrimary}
          />

          {/* Roles: full width below */}
          <div className="user-detail-roles-row">
            <UserRolesPanel
              key={`roles-${user.id}`}
              roles={roles}
              assignments={userRoles}
              busy={busy || busyAssignmentId !== null}
              busyAssignmentId={busyAssignmentId}
              canManage={canManage}
              onAssign={onAssignRole}
              onRevoke={onRevokeRole}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Memberships Panel ──────────────────────────────────────────────────────────

export { UserDetailPanel };
export type { UserDetailPanelProps };
