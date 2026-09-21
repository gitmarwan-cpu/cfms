import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClientError } from '../../api/axiosClient';
import {
  createPlatformUser,
  fetchPlatformUsers,
  type CreatePlatformUserInput,
  type PlatformUserListItem,
} from '../../api/platformApi';
import { DataState, FormDialog } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import Pagination from '../../components/patterns/Pagination';
import SearchInput from '../../components/patterns/SearchInput';
import FilterBar from '../../components/patterns/FilterBar';
import { Input } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/dateTime';

type ActiveFilter = 'all' | 'active' | 'inactive';

const PAGE_LIMIT = 20;
const emptyDraft: CreatePlatformUserInput = { fullName: '', email: '', password: '' };

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUserListItem[]>([]);
  const [pagination, setPagination] = useState<PlatformUserListResponse['pagination'] | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState<CreatePlatformUserInput>(emptyDraft);
  const [notice, setNotice] = useState('');

  const loadUsers = useCallback(() => {
    setLoading(true);
    setError('');
    fetchPlatformUsers({
      page,
      limit: PAGE_LIMIT,
      search: search.trim() || undefined,
      isActive: activeFilter === 'all' ? undefined : activeFilter === 'active' ? 'true' : 'false',
    })
      .then((response) => {
        setUsers(response.data);
        setPagination(response.pagination);
      })
      .catch((err: ApiClientError) => setError(err.message || 'تعذر تحميل مستخدمي المنصة.'))
      .finally(() => setLoading(false));
  }, [activeFilter, page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setFormError('');
    setCreateOpen(true);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await createPlatformUser({
        fullName: draft.fullName.trim(),
        email: draft.email.trim(),
        password: draft.password,
      });
      setCreateOpen(false);
      setDraft(emptyDraft);
      setNotice('تم إنشاء حساب المستخدم بنجاح. لم تتم إضافة عضوية أو دور تلقائياً.');
      loadUsers();
    } catch (err) {
      setFormError((err as ApiClientError).message || 'تعذر إنشاء المستخدم.');
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setActiveFilter('all');
    setPage(1);
  };

  const hasFilters = searchInput !== '' || activeFilter !== 'all';

  return (
    <div>
      <PageHeader
        title="مستخدمو المنصة"
        description="إدارة حسابات المستخدمين على مستوى المنصة دون إدارة عضويات أو أدوار المستأجرين."
        actions={<button className="btn btn-primary" type="button" onClick={openCreate}>إضافة مستخدم</button>}
      />

      {notice && <div className="admin-success" role="status" style={{ marginBottom: '16px' }}>{notice}</div>}

      <FilterBar onReset={hasFilters ? resetFilters : undefined}>
        <SearchInput
          label="بحث عن مستخدم"
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => { setPage(1); setSearch(searchInput); }}
          placeholder="الاسم أو البريد الإلكتروني…"
        />
        <label className="ds-field">
          <span className="ds-label">الحالة</span>
          <select
            className="ds-select"
            value={activeFilter}
            onChange={(event) => { setActiveFilter(event.target.value as ActiveFilter); setPage(1); }}
          >
            <option value="all">الكل</option>
            <option value="active">نشط</option>
            <option value="inactive">معطّل</option>
          </select>
        </label>
      </FilterBar>

      <DataState loading={loading} error={error} empty={!loading && !error && users.length === 0} onRetry={loadUsers}>
        <div className="card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الحالة</th>
                  <th>العضويات</th>
                  <th>تاريخ الإنشاء</th>
                  <th aria-label="إجراء" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.fullName}</strong></td>
                    <td dir="ltr">{user.email}</td>
                    <td><StatusBadge tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'نشط' : 'معطّل'}</StatusBadge></td>
                    <td>{user.activeMembershipCount} نشطة / {user.membershipCount} إجمالاً</td>
                    <td>{formatDate(user.createDate)}</td>
                    <td className="admin-actions">
                      <Link className="btn btn-outline" to={`/admin/platform/users/${user.id}`}>عرض</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onPageChange={setPage} />}
        </div>
      </DataState>

      {createOpen && (
        <FormDialog title="إضافة مستخدم منصة" onClose={() => setCreateOpen(false)} onSubmit={submitCreate} saving={saving} error={formError}>
          <div className="admin-form-grid">
            <Input label="الاسم الكامل" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} required autoComplete="name" />
            <Input label="البريد الإلكتروني" type="email" dir="ltr" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required autoComplete="email" />
            <Input label="كلمة المرور" type="password" dir="ltr" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} required minLength={8} autoComplete="new-password" hint="ثمانية أحرف على الأقل وتتضمن رقماً." />
          </div>
        </FormDialog>
      )}
    </div>
  );
}

type PlatformUserListResponse = Awaited<ReturnType<typeof fetchPlatformUsers>>;
