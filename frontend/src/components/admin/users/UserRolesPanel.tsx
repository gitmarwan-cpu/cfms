import { useState } from 'react';
import type { Role } from '../../../api/adminApi';
import type { UserRoleAssignment } from '../../../api/usersApi';

interface UserRolesPanelProps {
  /** All roles visible in the active organization. */
  roles: Role[];
  /** Current role assignments of the selected user. */
  assignments: UserRoleAssignment[];
  /** Set while any assign/revoke mutation is in flight. */
  busy: boolean;
  /** ID of the assignment currently being revoked (disables its button). */
  busyAssignmentId: number | null;
  canManage: boolean;
  onAssign: (roleId: number) => void;
  onRevoke: (assignmentId: number) => void;
}

/** Role assignment manager for a single user (GET/POST /users/:userId/roles). */
export default function UserRolesPanel({
  roles,
  assignments,
  busy,
  busyAssignmentId,
  canManage,
  onAssign,
  onRevoke,
}: UserRolesPanelProps) {
  const [nextRoleId, setNextRoleId] = useState('');

  const assignedRoleIds = new Set(assignments.map((a) => a.roleId));
  const availableRoles = roles.filter((r) => r.isActive && !assignedRoleIds.has(r.id));

  const handleAssign = () => {
    const parsed = Number(nextRoleId);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || busy) return;
    onAssign(parsed);
    setNextRoleId('');
  };

  return (
    <div className="card">
      <div className="card__header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>الأدوار</h2>
      </div>
      <div className="card__body">
        {assignments.length === 0 ? (
          <p className="admin-assign-note">لا توجد أدوار مخصصة لهذا المستخدم بعد.</p>
        ) : (
          <ul className="admin-assign-list">
            {assignments.map((a) => (
              <li key={a.id} className="admin-assign-item">
                <span>
                  <strong>{a.role.nameAr}</strong>
                  {a.role.nameEn && <small> · {a.role.nameEn}</small>}
                </span>
                {canManage && (
                  <button
                    type="button"
                    className="admin-text-button danger"
                    onClick={() => onRevoke(a.id)}
                    disabled={busy}
                    aria-label={`إلغاء دور ${a.role.nameAr}`}
                  >
                    {busyAssignmentId === a.id ? '…' : 'إلغاء'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && availableRoles.length > 0 && (
          <form
            className="admin-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleAssign();
            }}
          >
            <label className="field">
              <select
                value={nextRoleId}
                onChange={(e) => setNextRoleId(e.target.value)}
                aria-label="الدور المراد إسناده"
              >
                <option value="">إسناد دور…</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-outline" disabled={!nextRoleId || busy}>
              إسناد
            </button>
          </form>
        )}
      </div>
    </div>
  );
}