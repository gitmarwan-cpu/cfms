import { type Membership } from '../../../api/usersApi';
import { StatusBadge } from '../../ui/StatusBadge';

interface UserMembershipsPanelProps {
  memberships: Membership[];
  busy: boolean;
  busyMembershipId: number | null;
  canManage: boolean;
  /** Legal name of the ACTIVE tenant context — the org a new membership is added to. */
  organizationName?: string;
  onAdd: () => void;
  onRemove: (membershipId: number) => void;
  onSetPrimary: (membershipId: number) => void;
}

/**
 * Membership manager for a single user (GET/POST /users/:userId/memberships,
 * DELETE /users/memberships/:id, PATCH /users/memberships/:id/primary).
 * Server-side invariant messages (last-membership / last-active-admin /
 * self-removal) are surfaced verbatim by the parent — this panel only renders.
 * Tenant isolation: the target organization is ALWAYS the authenticated
 * tenant context (X-Organization-Id) — never a client-supplied id — so the
 * panel names that organization explicitly instead of implying it.
 */
function UserMembershipsPanel({
  memberships,
  busy,
  busyMembershipId,
  canManage,
  organizationName,
  onAdd,
  onRemove,
  onSetPrimary,
}: UserMembershipsPanelProps) {
  const targetOrgLabel = organizationName ? `«${organizationName}»` : 'المؤسسة الحالية';
  const hasActiveHere = memberships.some((m) => m.isActive);
  return (
    <div className="card">
      <div className="card__header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>العضويات</h2>
      </div>
      <div className="card__body">
        <p className="admin-assign-note" style={{ marginTop: 0 }}>
          العضويات المدرجة أدناه تخص المؤسسة النشطة {targetOrgLabel}. لإضافة المستخدم إلى مؤسسة أخرى، بدّل المؤسسة النشطة من مبدّل المؤسسات في الشريط العلوي أولاً.
        </p>
        {memberships.length === 0 ? (
          <p className="admin-assign-note">لا توجد عضويات مسجلة لهذا المستخدم في {targetOrgLabel}.</p>
        ) : (
          <ul className="admin-assign-list">
            {memberships.map((m) => (
              <li key={m.id} className="admin-assign-item">
                <span>
                  <strong>{m.organization ? m.organization.legalName : 'المؤسسة الحالية'}</strong>
                  {m.isPrimary && (
                    <StatusBadge tone="success" className="us-pill-inline">أساسية</StatusBadge>
                  )}
                  <StatusBadge tone={m.isActive ? 'success' : 'neutral'} className="us-pill-inline">{m.isActive ? 'نشطة' : 'معطّلة'}</StatusBadge>
                </span>
                {canManage && (
                  <span style={{ display: 'flex', gap: '6px' }}>
                    {!m.isPrimary && m.isActive && (
                      <button
                        type="button"
                        className="admin-text-button"
                        onClick={() => onSetPrimary(m.id)}
                        disabled={busy || busyMembershipId !== null}
                        aria-label="تعيين كعضوية أساسية"
                      >
                        {busyMembershipId === m.id ? '…' : 'تعيين أساسية'}
                      </button>
                    )}
                    {m.isActive && (
                      <button
                        type="button"
                        className="admin-text-button danger"
                        onClick={() => onRemove(m.id)}
                        disabled={busy || busyMembershipId !== null}
                        aria-label="إزالة العضوية"
                      >
                        {busyMembershipId === m.id ? '…' : 'إزالة'}
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className="admin-inline-form">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                if (window.confirm(`هل أنت متأكد من إضافة هذا المستخدم كعضو في ${targetOrgLabel}؟`)) {
                  onAdd();
                }
              }}
              disabled={busy || hasActiveHere}
            >
              {busy && busyMembershipId === null
                ? 'يرجى الانتظار...'
                : hasActiveHere
                  ? `عضو نشط بالفعل في ${targetOrgLabel}`
                  : `إضافة عضوية في ${targetOrgLabel}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reset Password Dialog ──────────────────────────────────────────────────────

export { UserMembershipsPanel };
export type { UserMembershipsPanelProps };
