import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  addUserToGroup,
  assignUserRole,
  createUser,
  fetchGroups,
  fetchOrgUnits,
  fetchRoles,
  fetchUserGroups,
  fetchUserRoles,
  fetchUsers,
  removeUserFromGroup,
  revokeUserRole,
  updateUserStatus,
  type AdminUser,
  type Group,
  type OrgUnit,
  type PaginationInfo,
  type Role,
  type UserGroupMembership,
  type UserRoleAssignment,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { ConfirmDialog, Dialog, FormDialog, PageHeader } from '../../components/admin/AdminUi';
import { getHierarchyPath } from '../../utils/orgHierarchy';

type Draft = { fullName: string; email: string; password: string; roleCode: string; orgUnitId: string };
const empty: Draft = { fullName: '', email: '', password: '', roleCode: 'staff', orgUnitId: '' };

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [statusUser, setStatusUser] = useState<AdminUser | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroupMembership[]>([]);
  const [detailRoleId, setDetailRoleId] = useState('');
  const [detailOrgUnitId, setDetailOrgUnitId] = useState('');
  const [detailGroupId, setDetailGroupId] = useState('');
  const [detailError, setDetailError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchUsers({ page, limit: 15, search: searchFilter || undefined })
      .then((res) => {
        setUsers(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => setError((err as ApiClientError).message || 'حدث خطأ أثناء جلب المستخدمين'))
      .finally(() => setLoading(false));
  }, [page, searchFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([fetchRoles(), fetchOrgUnits(), fetchGroups()])
      .then(([r, o, g]) => { setRoles(r); setOrgUnits(o); setGroups(g); })
      .catch(() => undefined);
  }, []);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchFilter(searchInput.trim());
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await createUser({
        fullName: draft.fullName,
        email: draft.email,
        password: draft.password,
        roleCode: draft.roleCode || undefined,
        orgUnitId: draft.orgUnitId ? Number(draft.orgUnitId) : undefined,
      });
      setCreating(false);
      setDraft(empty);
      setPage(1);
      load();
    } catch (err) {
      setFormError((err as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!statusUser) return;
    setStatusBusy(true);
    try {
      await updateUserStatus(statusUser.id, !statusUser.isActive);
      setStatusUser(null);
      load();
    } catch (err) {
      setError((err as ApiClientError).message);
      setStatusUser(null);
    } finally {
      setStatusBusy(false);
    }
  };

  const openDetail = async (user: AdminUser) => {
    setDetailError('');
    setDetailUser(user);
    setDetailRoleId('');
    setDetailOrgUnitId('');
    setDetailGroupId('');
    try {
      const [roleEntries, groupEntries] = await Promise.all([
        fetchUserRoles(user.id),
        fetchUserGroups(user.id),
      ]);
      setUserRoles(roleEntries);
      setUserGroups(groupEntries);
    } catch (err) {
      setDetailError((err as ApiClientError).message);
    }
  };

  const addRole = async () => {
    if (!detailUser || !detailRoleId) return;
    try {
      await assignUserRole(detailUser.id, Number(detailRoleId), detailOrgUnitId ? Number(detailOrgUnitId) : undefined);
      setUserRoles(await fetchUserRoles(detailUser.id));
      setDetailRoleId('');
      setDetailOrgUnitId('');
    } catch (err) {
      setDetailError((err as ApiClientError).message);
    }
  };

  const removeRole = async (userRoleId: number) => {
    if (!detailUser) return;
    try {
      await revokeUserRole(userRoleId);
      setUserRoles(await fetchUserRoles(detailUser.id));
    } catch (err) {
      setDetailError((err as ApiClientError).message);
    }
  };

  const addGroup = async () => {
    if (!detailUser || !detailGroupId) return;
    try {
      await addUserToGroup(detailUser.id, Number(detailGroupId));
      setUserGroups(await fetchUserGroups(detailUser.id));
      setDetailGroupId('');
    } catch (err) {
      setDetailError((err as ApiClientError).message);
    }
  };

  const removeGroup = async (userGroupId: number) => {
    if (!detailUser) return;
    try {
      await removeUserFromGroup(userGroupId);
      setUserGroups(await fetchUserGroups(detailUser.id));
    } catch (err) {
      setDetailError((err as ApiClientError).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="المستخدمون"
        description="إدارة مستخدمي المؤسسة وتفعيلهم وتعطيلهم وربطهم بالأدوار والمجموعات."
        actions={
          <button className="btn btn-primary" onClick={() => { setFormError(''); setDraft(empty); setCreating(true); }}>
            + إضافة مستخدم
          </button>
        }
      />

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card__body" style={{ padding: '16px 20px' }}>
          <form onSubmit={applySearch} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '2', minWidth: '220px', marginBottom: 0 }}>
              <label htmlFor="userSearch">البحث</label>
              <input
                id="userSearch"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="اسم المستخدم أو البريد الإلكتروني"
                style={{ flex: '1' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
              <button className="btn btn-primary" type="submit">بحث</button>
              {searchFilter && (
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => { setSearchInput(''); setSearchFilter(''); setPage(1); }}
                >
                  مسح
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}>{error}</div>}

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الوحدة التنظيمية</th>
                <th>الأدوار</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center' }}>جارٍ التحميل...</td></tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    لا يوجد مستخدمون ضمن مؤسستك.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>{user.email}</td>
                    <td>{user.orgUnit ? `${user.orgUnit.name}${user.orgUnit.code ? ` (${user.orgUnit.code})` : ''}` : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {user.roles.length === 0
                          ? <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          : user.roles.map((role) => (
                              <span key={role.id} className="admin-badge">{role.nameAr}</span>
                            ))}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge ${user.isActive ? '' : 'admin-status-badge--inactive'}`}
                        style={user.isActive
                          ? { background: '#d1fae5', color: '#065f46' }
                          : { background: '#e2e8f0', color: '#374151' }}
                      >
                        {user.isActive ? 'نشط' : 'معطّل'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="btn btn-outline" type="button" onClick={() => openDetail(user)}>
                          الأدوار والمجموعات
                        </button>
                        <button
                          className={`btn ${user.isActive ? 'admin-btn-danger' : 'btn-outline'}`}
                          type="button"
                          onClick={() => setStatusUser(user)}
                        >
                          {user.isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="admin-pagination">
            <button className="btn admin-pagination__btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">السابق</button>
            <span className="admin-pagination__info">صفحة {page} من {pagination.totalPages}</span>
            <button className="btn admin-pagination__btn" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} type="button">التالي</button>
          </div>
        )}
      </div>

      {creating && (
        <FormDialog
          title="إضافة مستخدم جديد"
          onClose={() => setCreating(false)}
          onSubmit={submitCreate}
          saving={saving}
          error={formError}
          submitLabel="إنشاء المستخدم"
        >
          <div className="field">
            <label htmlFor="userFullName">الاسم الكامل</label>
            <input
              id="userFullName"
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="userEmail">البريد الإلكتروني</label>
            <input
              id="userEmail"
              type="email"
              dir="ltr"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="userPassword">كلمة المرور</label>
            <input
              id="userPassword"
              type="password"
              dir="ltr"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              minLength={8}
              required
            />
            <small>8 أحرف على الأقل وتتضمن رقمًا واحدًا.</small>
          </div>
          <div className="field">
            <label htmlFor="userRole">الدور</label>
            <select
              id="userRole"
              value={draft.roleCode}
              onChange={(e) => setDraft({ ...draft, roleCode: e.target.value })}
            >
              <option value="staff">موظف خدمة (افتراضي)</option>
              {roles.filter((role) => role.isActive).map((role) => (
                <option key={role.id} value={role.code}>{role.nameAr}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="userOrgUnit">الوحدة التنظيمية</label>
            <select
              id="userOrgUnit"
              value={draft.orgUnitId}
              onChange={(e) => setDraft({ ...draft, orgUnitId: e.target.value })}
            >
              <option value="">بدون</option>
              {orgUnits.filter((unit) => unit.isActive).map((unit) => (
                <option key={unit.id} value={String(unit.id)}>{getHierarchyPath(unit.id, orgUnits) || unit.name}</option>
              ))}
            </select>
          </div>
        </FormDialog>
      )}

      {statusUser && (
        <ConfirmDialog
          title={statusUser.isActive ? 'تعطيل المستخدم' : 'تفعيل المستخدم'}
          message={
            statusUser.isActive
              ? `سيتم تعطيل حساب «${statusUser.fullName}» ولن يتمكن من تسجيل الدخول. هل أنت متأكد؟`
              : `سيتم إعادة تفعيل حساب «${statusUser.fullName}» ليتمكن من تسجيل الدخول. هل أنت متأكد؟`
          }
          confirmLabel={statusUser.isActive ? 'تعطيل' : 'تفعيل'}
          onClose={() => setStatusUser(null)}
          onConfirm={toggleStatus}
          busy={statusBusy}
        />
      )}

      {detailUser && (
        <Dialog title={`الأدوار والمجموعات — ${detailUser.fullName}`} onClose={() => setDetailUser(null)}>
          <div className="admin-dialog__form">
            {detailError && <div className="alert alert-danger" role="alert">{detailError}</div>}

            <section style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '8px' }}>الأدوار</h3>
              {userRoles.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>لا توجد أدوار.</p>
              ) : (
                <ul className="admin-list">
                  {userRoles.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.role.nameAr}{entry.orgUnit ? ` — ${entry.orgUnit.name}` : ''}</span>
                      <button
                        className="admin-icon-button"
                        onClick={() => removeRole(entry.id)}
                        aria-label="إلغاء الدور"
                        title="إلغاء الدور"
                      >×</button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
                <div className="field" style={{ flex: '1', minWidth: '140px', marginBottom: 0 }}>
                  <label htmlFor="assignRoleSelect">إسناد دور</label>
                  <select id="assignRoleSelect" value={detailRoleId} onChange={(e) => setDetailRoleId(e.target.value)}>
                    <option value="">اختر الدور</option>
                    {roles.filter((role) => role.isActive && !userRoles.some((entry) => entry.roleId === role.id)).map((role) => (
                      <option key={role.id} value={String(role.id)}>{role.nameAr}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: '1', minWidth: '140px', marginBottom: 0 }}>
                  <label htmlFor="assignRoleUnit">الوحدة (اختياري)</label>
                  <select id="assignRoleUnit" value={detailOrgUnitId} onChange={(e) => setDetailOrgUnitId(e.target.value)}>
                    <option value="">بدون</option>
                    {orgUnits.filter((unit) => unit.isActive).map((unit) => (
                      <option key={unit.id} value={String(unit.id)}>{getHierarchyPath(unit.id, orgUnits) || unit.name}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" type="button" onClick={addRole} disabled={!detailRoleId}>إسناد</button>
              </div>
            </section>

            <section>
              <h3 style={{ marginBottom: '8px' }}>المجموعات</h3>
              {userGroups.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>لا توجد مجموعات.</p>
              ) : (
                <ul className="admin-list">
                  {userGroups.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.group.nameAr}</span>
                      <button
                        className="admin-icon-button"
                        onClick={() => removeGroup(entry.id)}
                        aria-label="إزالة من المجموعة"
                        title="إزالة من المجموعة"
                      >×</button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
                <div className="field" style={{ flex: '1', minWidth: '140px', marginBottom: 0 }}>
                  <label htmlFor="assignGroupSelect">إضافة إلى مجموعة</label>
                  <select id="assignGroupSelect" value={detailGroupId} onChange={(e) => setDetailGroupId(e.target.value)}>
                    <option value="">اختر المجموعة</option>
                    {groups.filter((group) => group.isActive && !userGroups.some((entry) => entry.groupId === group.id)).map((group) => (
                      <option key={group.id} value={String(group.id)}>{group.nameAr}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" type="button" onClick={addGroup} disabled={!detailGroupId}>إضافة</button>
              </div>
            </section>
          </div>
        </Dialog>
      )}
    </div>
  );
}