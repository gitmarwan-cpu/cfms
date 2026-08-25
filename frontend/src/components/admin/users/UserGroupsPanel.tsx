import { useState } from 'react';
import type { Group } from '../../../api/adminApi';
import type { UserGroupAssignment } from '../../../api/usersApi';

interface UserGroupsPanelProps {
  /** All groups visible in the active organization. */
  groups: Group[];
  /** Current group memberships of the selected user. */
  assignments: UserGroupAssignment[];
  /** Set while a mutation is in flight. */
  busy: boolean;
  busyAssignmentId: number | null;
  canManage: boolean;
  onAdd: (groupId: number) => void;
  onRemove: (userGroupId: number) => void;
}

/** Group membership manager for a single user (GET/POST /users/:userId/groups). */
export default function UserGroupsPanel({
  groups,
  assignments,
  busy,
  busyAssignmentId,
  canManage,
  onAdd,
  onRemove,
}: UserGroupsPanelProps) {
  const [nextGroupId, setNextGroupId] = useState('');

  const assignedGroupIds = new Set(assignments.map((a) => a.groupId));
  const availableGroups = groups.filter((g) => g.isActive && !assignedGroupIds.has(g.id));

  const handleAdd = () => {
    const parsed = Number(nextGroupId);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || busy) return;
    onAdd(parsed);
    setNextGroupId('');
  };

  return (
    <div className="card">
      <div className="card__header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>المجموعات</h2>
      </div>
      <div className="card__body">
        {assignments.length === 0 ? (
          <p className="admin-assign-note">المستخدم ليس منضماً لأي مجموعة بعد.</p>
        ) : (
          <ul className="admin-assign-list">
            {assignments.map((a) => (
              <li key={a.id} className="admin-assign-item">
                <span>
                  <strong>{a.group.nameAr}</strong>
                  {a.group.nameEn ? <small> · {a.group.nameEn}</small> : null}
                </span>
                {canManage && (
                  <button
                    type="button"
                    className="admin-text-button"
                    onClick={() => onRemove(a.id)}
                    disabled={busy}
                    aria-label={`إزالة من مجموعة ${a.group.nameAr}`}
                  >
                    {busyAssignmentId === a.id ? '…' : 'إزالة'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && availableGroups.length > 0 && (
          <form
            className="admin-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <label className="field">
              <select
                value={nextGroupId}
                onChange={(e) => setNextGroupId(e.target.value)}
                aria-label="إضافة إلى مجموعة"
              >
                <option value="">إضافة إلى مجموعة…</option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-outline" disabled={!nextGroupId || busy}>
              إضافة
            </button>
          </form>
        )}
      </div>
    </div>
  );
}