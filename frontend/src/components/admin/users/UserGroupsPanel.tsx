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

/** Read-only compatibility view for legacy Group memberships. */
export default function UserGroupsPanel({
  assignments,
}: UserGroupsPanelProps) {
  return (
    <div className="card">
      <div className="card__header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>المجموعات</h2>
      </div>
      <div className="card__body">
        <p className="admin-assign-note">المجموعات مجمّدة للقراءة فقط؛ لا تُستخدم لمنح الصلاحيات ولا يمكن تعديل العضويات.</p>
        {assignments.length === 0 ? (
          <p className="admin-assign-note">لا توجد عضوية Group محفوظة لهذا المستخدم.</p>
        ) : (
          <ul className="admin-assign-list">
            {assignments.map((a) => (
              <li key={a.id} className="admin-assign-item">
                <span>
                  <strong>{a.group.nameAr}</strong>
                  {a.group.nameEn ? <small> · {a.group.nameEn}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  );
}
