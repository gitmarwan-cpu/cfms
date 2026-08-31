import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PageHeader, LoadingSkeleton, DataState, ConfirmDialog, FormDialog } from '../../components/admin/AdminUi';
import { useAuth } from '../../context/AuthContext';
import { fetchRoles, type Role } from '../../api/adminApi';
import {
  activateUser,
  addMembership as addMembershipApi,
  assignUserRole,
  deactivateUser,
  fetchUser,
  fetchUserMemberships,
  fetchUserRoles,
  fetchUsers,
  removeMembership as removeMembershipApi,
  resetUserPassword,
  revokeUserRole,
  setPrimaryMembership as setPrimaryMembershipApi,
  type ManagedUser,
  type Membership,
  type UserRoleAssignment,
} from '../../api/usersApi';
import type { ApiClientError } from '../../api/axiosClient';
import AuditMetadata from '../../components/admin/AuditMetadata';
import UserCreateDialog from '../../components/admin/users/UserCreateDialog';
import UserEditDialog from '../../components/admin/users/UserEditDialog';
import UserRolesPanel from '../../components/admin/users/UserRolesPanel';
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
  const { user, hasPermission, currentOrganizationId, refreshMe } = useAuth();
  const orgId = currentOrganizationId;

  const canView = orgId !== null && hasPermission('users.view', orgId);
  const canManage = orgId !== null && hasPermission('users.manage', orgId);

  // ── Reference data (roles) ────────────────────────────────────────────────
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchRoles().then((r) => { if (mounted) setRoles(r); }).catch(() => { /* detail access reports failures */ });
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
  const [userMemberships, setUserMemberships] = useState<Membership[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');

  const [busy, setBusy] = useState(false);
  const [busyAssignmentId, setBusyAssignmentId] = useState<number | null>(null);
  const [busyMembershipId, setBusyMembershipId] = useState<number | null>(null);

  // ── Dialogs ────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // ── Select a user ──────────────────────────────────────────────────────────
  const loadMemberships = useCallback((userId: number) => {
    fetchUserMemberships(userId)
      .then((r) => setUserMemberships(r))
      .catch(() => setUserMemberships([])); // membership load failures surface via role errors
  }, []);

  const selectUser = useCallback((u: ManagedUser) => {
    setSelectedUser(u);
    setDetailError('');
    setAccessError('');
    setMobileDetailOpen(true);
    setAccessLoading(true);
    loadMemberships(u.id);
    fetchUserRoles(u.id)
      .then((r) => { setUserRoles(r); })
      .catch((err: ApiClientError) => {
        setUserRoles([]);
        setAccessError(err.message || 'تعذر تحميل أدوار المستخدم.');
      })
      .finally(() => setAccessLoading(false));
  }, [loadMemberships]);

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
    loadMemberships(userId);
    fetchUserRoles(userId)
      .then((r) => { setUserRoles(r); })
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر تحميل أدوار المستخدم.'))
      .finally(() => setAccessLoading(false));
  }, [loadMemberships]);

  const clearSelection = () => {
    setSelectedUser(null);
    setUserRoles([]);
    setUserMemberships([]);
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

  // ── Membership handlers ───────────────────────────────────────────────────
  // Server-side invariant messages (last-membership / last-active-admin /
  // self-removal) are surfaced VERBATIM — no friendlier rewording that hides
  // the actual constraint from the admin.
  const handleAddMembership = () => {
    if (!selectedUser) return;
    setBusy(true);
    setAccessError('');
    addMembershipApi(selectedUser.id)
      .then(() => {
        loadMemberships(selectedUser.id);
        setNotice(`تمت إضافة «${selectedUser.fullName}» كعضو في المؤسسة بنجاح.`);
      })
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر إضافة العضوية.'))
      .finally(() => setBusy(false));
  };

  const handleRemoveMembership = (membershipId: number) => {
    if (!selectedUser) return;
    setBusyMembershipId(membershipId);
    setAccessError('');
    removeMembershipApi(membershipId)
      .then(() => {
        loadMemberships(selectedUser.id);
        setNotice('تم إلغاء العضوية بنجاح.');
      })
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر إلغاء العضوية.'))
      .finally(() => setBusyMembershipId(null));
  };

  const handleSetPrimary = (membershipId: number) => {
    if (!selectedUser) return;
    setBusyMembershipId(membershipId);
    setAccessError('');
    setPrimaryMembershipApi(membershipId)
      .then(() => {
        loadMemberships(selectedUser.id);
        setNotice('تم تعيين العضوية الأساسية بنجاح.');
        // The logged-in admin changed their OWN primary organization — the
        // default-organization resolution must be re-fetched so the
        // organization switcher (and the primary badge) stays correct.
        if (user && selectedUser.id === user.id) return refreshMe();
        return undefined;
      })
      .catch((err: ApiClientError) => setAccessError(err.message || 'تعذر تعيين العضوية الأساسية.'))
      .finally(() => setBusyMembershipId(null));
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
              userRoles={userRoles}
              memberships={userMemberships}
              accessLoading={accessLoading}
              accessError={accessError}
              busy={busy}
              busyAssignmentId={busyAssignmentId}
              busyMembershipId={busyMembershipId}
              canManage={canManage}
              onEdit={() => setEditOpen(true)}
              onDeactivate={() => setConfirmDeactivate(true)}
              onActivate={handleActivate}
              onClose={clearSelection}
              onAssignRole={assignRole}
              onRevokeRole={revokeRole}
              onAddMembership={handleAddMembership}
              onRemoveMembership={handleRemoveMembership}
              onSetPrimary={handleSetPrimary}
              onResetPassword={() => setResetPasswordOpen(true)}
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

      {resetPasswordOpen && selectedUser && (
        <ResetPasswordDialog
          user={selectedUser}
          onClose={() => setResetPasswordOpen(false)}
          onReset={(updatedName) => {
            setResetPasswordOpen(false);
            setNotice(`تم إعادة تعيين كلمة المرور لـ «${updatedName}» بنجاح.`);
          }}
        />
      )}
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────────

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

      {/* Direct roles panel */}
      {accessLoading ? (
        <div className="admin-detail-grid">
          <div className="card">
            <div className="card__header"><LoadingSkeleton rows={1} /></div>
            <div className="card__body"><LoadingSkeleton rows={3} /></div>
          </div>
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
          <UserMembershipsPanel
            key={`memberships-${user.id}`}
            memberships={memberships}
            busy={busy}
            busyMembershipId={busyMembershipId}
            canManage={canManage}
            onAdd={onAddMembership}
            onRemove={onRemoveMembership}
            onSetPrimary={onSetPrimary}
          />
        </div>
      )}
    </div>
  );
}

// ── Memberships Panel ──────────────────────────────────────────────────────────

interface UserMembershipsPanelProps {
  memberships: Membership[];
  busy: boolean;
  busyMembershipId: number | null;
  canManage: boolean;
  onAdd: () => void;
  onRemove: (membershipId: number) => void;
  onSetPrimary: (membershipId: number) => void;
}

/**
 * Membership manager for a single user (GET/POST /users/:userId/memberships,
 * DELETE /users/memberships/:id, PATCH /users/memberships/:id/primary).
 * Server-side invariant messages (last-membership / last-active-admin /
 * self-removal) are surfaced verbatim by the parent — this panel only renders.
 */
function UserMembershipsPanel({
  memberships,
  busy,
  busyMembershipId,
  canManage,
  onAdd,
  onRemove,
  onSetPrimary,
}: UserMembershipsPanelProps) {
  return (
    <div className="card">
      <div className="card__header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>العضويات</h2>
      </div>
      <div className="card__body">
        {memberships.length === 0 ? (
          <p className="admin-assign-note">لا توجد عضويات مسجلة لهذا المستخدم في هذه المؤسسة.</p>
        ) : (
          <ul className="admin-assign-list">
            {memberships.map((m) => (
              <li key={m.id} className="admin-assign-item">
                <span>
                  <strong>{m.organization ? m.organization.legalName : `مؤسسة #${m.organizationId}`}</strong>
                  {m.isPrimary && (
                    <span className="admin-status-pill is-success" style={{ marginInlineStart: '8px' }}>
                      أساسية
                    </span>
                  )}
                  <span className={`admin-status-pill ${m.isActive ? 'is-success' : ''}`} style={{ marginInlineStart: '8px' }}>
                    {m.isActive ? 'نشطة' : 'معطّلة'}
                  </span>
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
              onClick={onAdd}
              disabled={busy || memberships.some((m) => m.isActive)}
            >
              {memberships.some((m) => m.isActive) ? 'عضو نشط بالفعل' : 'إضافة عضوية'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reset Password Dialog ──────────────────────────────────────────────────────

interface ResetPasswordDialogProps {
  user: ManagedUser;
  onClose: () => void;
  onReset: (userFullName: string) => void;
}

/**
 * Admin-issued password reset (POST /users/:userId/reset-password, users.manage).
 * The new password is typed by the admin and is never stored, logged, or echoed.
 */
function ResetPasswordDialog({ user, onClose, onReset }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!newPassword) {
      setError('الرجاء إدخال كلمة المرور الجديدة.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setSaving(true);
    try {
      await resetUserPassword(user.id, newPassword);
      onReset(user.fullName);
    } catch (err) {
      const apiErr = err as ApiClientError;
      // Surface server-side policy messages verbatim; never echo the password.
      setError(apiErr.message || 'تعذر إعادة تعيين كلمة المرور. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      title={`إعادة تعيين كلمة المرور: ${user.fullName}`}
      onClose={onClose}
      onSubmit={submit}
      saving={saving}
      error={error}
      submitLabel="إعادة التعيين"
    >
      <label className="field">
        كلمة المرور الجديدة
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="field">
        تأكيد كلمة المرور الجديدة
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
    </FormDialog>
  );
}
