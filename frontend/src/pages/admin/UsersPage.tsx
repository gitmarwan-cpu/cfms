import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader, LoadingSkeleton, DataState, ConfirmDialog } from '../../components/admin/AdminUi';
import { useAuth } from '../../context/AuthContext';
import { fetchGroups, fetchRoles, type Group, type Role } from '../../api/adminApi';
import {
  activateUser,
  addUserToGroup,
  assignUserRole,
  deactivateUser,
  fetchUser,
  fetchUserGroups,
  fetchUserRoles,
  fetchUsers,
  registerUser,
  removeUserFromGroup,
  revokeUserRole,
  type ManagedUser,
  type UserGroupAssignment,
  type UserRoleAssignment,
} from '../../api/usersApi';
import type { ApiClientError } from '../../api/axiosClient';
import AuditMetadata from '../../components/admin/AuditMetadata';
import UserCreateDialog from '../../components/admin/users/UserCreateDialog';
import UserEditDialog from '../../components/admin/users/UserEditDialog';
import UserRolesPanel from '../../components/admin/users/UserRolesPanel';
import UserGroupsPanel from '../../components/admin/users/UserGroupsPanel';
import { formatDate } from '../../utils/dateTime';

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveFilter = 'all' | 'active' | 'inactive';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 350;

// ── Component ──────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user, hasPermission } = useAuth();
  const orgId = user?.defaultOrganizationId ?? null;

  const canView = orgId !== null && hasPermission('users.view', orgId);
  const canManage = orgId !== null && hasPermission('users.manage', orgId);

  // ── Reference data (roles / groups) ───────────────────────────────────────
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchRoles(), fetchGroups()])
      .then(([r, g]) => {
        if (mounted) { setRoles(r); setGroups(g); }
      })
      .catch(() => { /* non-fatal: panels remain empty */ });
    return () => { mounted = false; };
  }, []);

  // ── User list state ────────────────────────────────────────────────────────
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(value);
    }, DEBOUNCE_MS);
  };

  const loadUsers = useCallback(() => {
    setListLoading(true);
    setListError('');
    const params: Parameters<typeof fetchUsers>[0] = { page, limit: PAGE_LIMIT };
    if (search.trim()) params.search = search.trim();
    if (activeFilter === 'active') params.isActive = 'true';
    if (activeFilter === 'inactive') params.isActive = 'false';
    fetchUsers(params)
      .then((res) => { setUsers(res.data); setPagination(res.pagination); })
      .catch((err: ApiClientError) => setListError(err.message || 'تعذر تحميل المستخدمين.'))
      .finally(() => setListLoading(false));
  }, [page, search, activeFilter]);

  useEffect(() => { if (canView) loadUsers(); }, [loadUsers, canView]);

  // ── Selected user + detail state ───────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroupAssignment[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');

  const [busy, setBusy] = useState(false);
  const [busyAssignmentId, setBusyAssignmentId] = useState<number | null>(null);

  // ── Dialogs ────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // ── Select a user ──────────────────────────────────────────────────────────
  const selectUser = useCallback((u: ManagedUser) => {
    setSelectedUser(u);
    setDetailError('');
    setAccessError('');
    setMobileDetailOpen(true);
    setAccessLoading(true);
    Promise.all([fetchUserRoles(u.id), fetchUserGroups(u.id)])
      .then(([r, g]) => { setUserRoles(r); setUserGroups(g); })
      .catch((err: ApiClientError) => {
        setUserRoles([]);
        setUserGroups([]);
        setAccessError(err.message || 'تعذر تحميل أدوار المستخدم ومجموعاته.');
      })
      .finally(() => setAccessLoading(false));
  }, []);

  const refreshSelectedUser = useCallback((userId: number) => {
    fetchUser(userId)
      .then((updated) => {
        setSelectedUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  const refreshAccess = useCallback((userId: number) => {
    setAccessLoading(true);
    setAccessError('');
    Promise.all([fetchUserRoles(userId), fetchUserGroups(userId)])
      .then(([r, g]) => { setUserRoles(r); setUserGroups(g); })
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر تحميل أدوار المستخدم.'))
      .finally(() => setAccessLoading(false));
  }, []);

  const clearSelection = () => {
    setSelectedUser(null);
    setUserRoles([]);
    setUserGroups([]);
    setAccessError('');
    setDetailError('');
    setMobileDetailOpen(false);
  };

  // ── Create / Edit handlers ─────────────────────────────────────────────────
  const handleCreated = (created: ManagedUser) => {
    setCreateOpen(false);
    setNotice(`تم إنشاء المستخدم «${created.fullName}» بنجاح.`);
    loadUsers();
    selectUser(created);
  };

  const handleSaved = (updated: ManagedUser) => {
    setEditOpen(false);
    setSelectedUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setNotice(`تم تحديث بيانات «${updated.fullName}» بنجاح.`);
  };

  // ── Activate / Deactivate ──────────────────────────────────────────────────
  const handleDeactivate = () => {
    if (!selectedUser) return;
    setBusy(true);
    setAccessError('');
    deactivateUser(selectedUser.id)
      .then((updated) => {
        setConfirmDeactivate(false);
        setSelectedUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setNotice(`تم إلغاء تفعيل «${updated.fullName}» بنجاح.`);
      })
      .catch((err: ApiClientError) => {
        setConfirmDeactivate(false);
        setAccessError(err.message || 'تعذر إلغاء التفعيل.');
      })
      .finally(() => setBusy(false));
  };

  const handleActivate = () => {
    if (!selectedUser) return;
    setBusy(true);
    setAccessError('');
    activateUser(selectedUser.id)
      .then((updated) => {
        setSelectedUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setNotice(`تم تفعيل «${updated.fullName}» بنجاح.`);
      })
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر التفعيل.'))
      .finally(() => setBusy(false));
  };

  // ── Role handlers ─────────────────────────────────────────────────────────
  const assignRole = (roleId: number) => {
    if (!selectedUser) return;
    setBusy(true);
    setAccessError('');
    assignUserRole(selectedUser.id, roleId)
      .then(() => fetchUserRoles(selectedUser.id))
      .then(setUserRoles)
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر إسناد الدور.'))
      .finally(() => setBusy(false));
  };

  const revokeRole = (assignmentId: number) => {
    if (!selectedUser) return;
    setBusyAssignmentId(assignmentId);
    setAccessError('');
    revokeUserRole(assignmentId)
      .then(() => fetchUserRoles(selectedUser.id))
      .then(setUserRoles)
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر إلغاء الدور.'))
      .finally(() => setBusyAssignmentId(null));
  };

  // ── Group handlers ────────────────────────────────────────────────────────
  const addGroup = (groupId: number) => {
    if (!selectedUser) return;
    setBusy(true);
    setAccessError('');
    addUserToGroup(selectedUser.id, groupId)
      .then(() => fetchUserGroups(selectedUser.id))
      .then(setUserGroups)
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر إضافة المجموعة.'))
      .finally(() => setBusy(false));
  };

  const removeGroup = (userGroupId: number) => {
    if (!selectedUser) return;
    setBusyAssignmentId(userGroupId);
    setAccessError('');
    removeUserFromGroup(userGroupId)
      .then(() => fetchUserGroups(selectedUser.id))
      .then(setUserGroups)
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر إزالة المجموعة.'))
      .finally(() => setBusyAssignmentId(null));
  };

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!user) return null;

  if (!canView) {
    return (
      <div>
        <PageHeader title="المستخدمون" description="إدارة مستخدمي النظام ضمن نطاق المؤسسة الحالية." />
        <div className="card">
          <div className="card__body">
            <p>ليس لديك صلاحية «users.view» لعرض إدارة المستخدمين ضمن هذه المؤسسة.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="المستخدمون"
        description="إدارة مستخدمي النظام ضمن نطاق المؤسسة الحالية."
        actions={
          canManage && (
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)} type="button">
              إضافة مستخدم
            </button>
          )
        }
      />

      {notice && (
        <div className="admin-success" role="status" style={{ marginBottom: '16px' }}>
          {notice}
          <button
            type="button"
            className="admin-text-button"
            style={{ marginRight: '12px', fontSize: '12px' }}
            onClick={() => setNotice('')}
            aria-label="إغلاق الإشعار"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card admin-filter-bar" style={{ marginBottom: '16px' }}>
        <label className="field" style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="بحث بالاسم أو البريد الإلكتروني…"
            aria-label="بحث عن مستخدم"
          />
        </label>
        <div role="group" aria-label="فلتر الحالة" style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn ${activeFilter === f ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => { setActiveFilter(f); setPage(1); }}
              aria-pressed={activeFilter === f}
            >
              {f === 'all' ? 'الكل' : f === 'active' ? 'نشط' : 'معطّل'}
            </button>
          ))}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="users-layout">
        {/* User Table Panel */}
        <div className={`users-list-panel ${mobileDetailOpen ? 'users-list-panel--hidden-mobile' : ''}`}>
          <div className="card">
            <DataState
              loading={listLoading}
              error={listError}
              empty={!listLoading && !listError && users.length === 0}
              onRetry={loadUsers}
            >
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>البريد الإلكتروني</th>
                      <th>العقدة التنظيمية</th>
                      <th>الحالة</th>
                      <th>تاريخ الإنشاء</th>
                      <th aria-label="إجراءات"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className={`admin-table-row ${selectedUser?.id === u.id ? 'admin-table-row--selected' : ''}`}
                        onClick={() => selectUser(u)}
                        style={{ cursor: 'pointer' }}
                        aria-selected={selectedUser?.id === u.id}
                      >
                        <td>
                          <strong>{u.fullName}</strong>
                        </td>
                        <td dir="ltr" style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                          {u.email}
                        </td>
                        <td style={{ fontSize: '13px' }}>
                          {u.primaryOrganizationNode
                            ? u.primaryOrganizationNode.shortName || u.primaryOrganizationNode.legalName
                            : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                        </td>
                        <td>
                          <span className={`admin-status-pill ${u.isActive ? 'is-success' : ''}`}>
                            {u.isActive ? 'نشط' : 'معطّل'}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          {formatDate(u.createdAt)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => selectUser(u)}
                            aria-label={`إدارة ${u.fullName}`}
                          >
                            إدارة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="admin-pagination">
                  <button
                    className="btn admin-pagination__btn"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    type="button"
                  >
                    السابق
                  </button>
                  <span>صفحة {page} من {pagination.totalPages} ({pagination.total} مستخدم)</span>
                  <button
                    className="btn admin-pagination__btn"
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    type="button"
                  >
                    التالي
                  </button>
                </div>
              )}

              {pagination && pagination.totalPages <= 1 && pagination.total > 0 && (
                <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {pagination.total} مستخدم
                </div>
              )}
            </DataState>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedUser ? (
          <div className={`users-detail-panel ${!mobileDetailOpen ? 'users-detail-panel--hidden-mobile' : ''}`}>
            <UserDetailPanel
              user={selectedUser}
              roles={roles}
              groups={groups}
              userRoles={userRoles}
              userGroups={userGroups}
              accessLoading={accessLoading}
              accessError={accessError}
              busy={busy}
              busyAssignmentId={busyAssignmentId}
              canManage={canManage}
              onEdit={() => setEditOpen(true)}
              onDeactivate={() => setConfirmDeactivate(true)}
              onActivate={handleActivate}
              onClose={clearSelection}
              onAssignRole={assignRole}
              onRevokeRole={revokeRole}
              onAddGroup={addGroup}
              onRemoveGroup={removeGroup}
            />
          </div>
        ) : (
          <div className="users-detail-panel users-detail-panel--empty">
            <div className="card">
              <div className="card__body" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>👤</div>
                <p style={{ margin: 0 }}>اختر مستخدماً من القائمة لعرض تفاصيله وإدارة صلاحياته.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {createOpen && (
        <UserCreateDialog
          roles={roles}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {editOpen && selectedUser && (
        <UserEditDialog
          user={selectedUser}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {confirmDeactivate && selectedUser && (
        <ConfirmDialog
          title="تأكيد إلغاء التفعيل"
          message={`هل أنت متأكد من إلغاء تفعيل المستخدم «${selectedUser.fullName}»؟ لن يتمكن المستخدم من تسجيل الدخول حتى يتم إعادة تفعيله.`}
          onClose={() => setConfirmDeactivate(false)}
          onConfirm={handleDeactivate}
          busy={busy}
        />
      )}
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────────

interface UserDetailPanelProps {
  user: ManagedUser;
  roles: Role[];
  groups: Group[];
  userRoles: UserRoleAssignment[];
  userGroups: UserGroupAssignment[];
  accessLoading: boolean;
  accessError: string;
  busy: boolean;
  busyAssignmentId: number | null;
  canManage: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
  onClose: () => void;
  onAssignRole: (roleId: number) => void;
  onRevokeRole: (assignmentId: number) => void;
  onAddGroup: (groupId: number) => void;
  onRemoveGroup: (userGroupId: number) => void;
}

function UserDetailPanel({
  user,
  roles,
  groups,
  userRoles,
  userGroups,
  accessLoading,
  accessError,
  busy,
  busyAssignmentId,
  canManage,
  onEdit,
  onDeactivate,
  onActivate,
  onClose,
  onAssignRole,
  onRevokeRole,
  onAddGroup,
  onRemoveGroup,
}: UserDetailPanelProps) {
  return (
    <div>
      {/* Identity card */}
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
            <span className={`admin-status-pill ${user.isActive ? 'is-success' : ''}`}>
              {user.isActive ? 'نشط' : 'معطّل'}
            </span>
            {canManage && (
              <>
                <button type="button" className="btn btn-outline" style={{ fontSize: '13px' }} onClick={onEdit}>
                  تعديل
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
              ✕
            </button>
          </span>
        </div>

        <div className="card__body">
          {accessError && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: '12px' }}>
              {accessError}
            </div>
          )}

          <div className="admin-detail-fields">
            <div>
              <span className="admin-detail-label">البريد الإلكتروني</span>
              <span className="admin-detail-value" dir="ltr" style={{ display: 'inline-block' }}>{user.email}</span>
            </div>
            {user.primaryOrganizationNode && (
              <div>
                <span className="admin-detail-label">العقدة التنظيمية</span>
                <span className="admin-detail-value">
                  {user.primaryOrganizationNode.legalName}
                  {user.primaryOrganizationNode.code && (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginRight: '6px' }}>
                      ({user.primaryOrganizationNode.code})
                    </span>
                  )}
                </span>
              </div>
            )}
            {!user.primaryOrganizationNode && (
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

      {/* Roles and Groups */}
      {accessLoading ? (
        <div className="admin-detail-grid">
          {[0, 1].map((i) => (
            <div key={i} className="card">
              <div className="card__header"><LoadingSkeleton rows={1} /></div>
              <div className="card__body"><LoadingSkeleton rows={3} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-detail-grid">
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
          <UserGroupsPanel
            key={`groups-${user.id}`}
            groups={groups}
            assignments={userGroups}
            busy={busy || busyAssignmentId !== null}
            busyAssignmentId={busyAssignmentId}
            canManage={canManage}
            onAdd={onAddGroup}
            onRemove={onRemoveGroup}
          />
        </div>
      )}
    </div>
  );
}