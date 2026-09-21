import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClientError } from '../../api/axiosClient';
import {
  fetchPlatformTenants,
  type PlatformTenantDirectoryItem,
  type PlatformTenantLifecycleStatus,
} from '../../api/platformApi';
import DataTable, { type DataTableColumn } from '../../components/admin/ui/DataTable';
import FilterBar from '../../components/patterns/FilterBar';
import PageHeader from '../../components/patterns/PageHeader';
import Pagination from '../../components/patterns/Pagination';
import SearchInput from '../../components/patterns/SearchInput';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/dateTime';

const PAGE_LIMIT = 20;

const LIFECYCLE_OPTIONS: Array<{ value: '' | PlatformTenantLifecycleStatus; label: string }> = [
  { value: '', label: 'كل الحالات' },
  { value: 'provisioning', label: 'قيد التهيئة' },
  { value: 'active', label: 'نشط' },
  { value: 'suspended', label: 'موقوف' },
  { value: 'deactivated', label: 'معطّل' },
  { value: 'archived', label: 'مؤرشف' },
];

const statusMeta: Record<PlatformTenantLifecycleStatus, { label: string; tone: StatusTone }> = {
  provisioning: { label: 'قيد التهيئة', tone: 'info' },
  active: { label: 'نشط', tone: 'success' },
  suspended: { label: 'موقوف', tone: 'warning' },
  deactivated: { label: 'معطّل', tone: 'danger' },
  archived: { label: 'مؤرشف', tone: 'neutral' },
};

const lifecycleBadge = (status: PlatformTenantLifecycleStatus) => {
  const meta = statusMeta[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
};

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<PlatformTenantDirectoryItem[]>([]);
  const [pagination, setPagination] = useState<Awaited<ReturnType<typeof fetchPlatformTenants>>['pagination'] | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycleStatus, setLifecycleStatus] = useState<'' | PlatformTenantLifecycleStatus>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTenants = useCallback(() => {
    setLoading(true);
    setError('');
    fetchPlatformTenants({
      page,
      limit: PAGE_LIMIT,
      search: search || undefined,
      lifecycleStatus: lifecycleStatus || undefined,
    })
      .then((response) => {
        setTenants(response.data);
        setPagination(response.pagination);
      })
      .catch((err: ApiClientError) => setError(err.message || 'تعذر تحميل دليل المستأجرين.'))
      .finally(() => setLoading(false));
  }, [lifecycleStatus, page, search]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setLifecycleStatus('');
    setPage(1);
  };

  const hasFilters = searchInput !== '' || lifecycleStatus !== '';

  const columns: DataTableColumn<PlatformTenantDirectoryItem>[] = [
    {
      key: 'legalName',
      header: 'المستأجر',
      render: (tenant) => (
        <Link className="admin-table__link" to={`/admin/platform/tenants/${tenant.id}`}>
          <strong>{tenant.legalName}</strong>
        </Link>
      ),
    },
    {
      key: 'slug',
      header: 'المعرّف',
      render: (tenant) => <code dir="ltr">{tenant.slug}</code>,
    },
    {
      key: 'lifecycleStatus',
      header: 'الحالة',
      render: (tenant) => lifecycleBadge(tenant.lifecycleStatus),
    },
    {
      key: 'statusChangedAt',
      header: 'آخر تغيير للحالة',
      render: (tenant) => formatDateTime(tenant.statusChangedAt),
    },
    {
      key: 'createdAt',
      header: 'تاريخ الإنشاء',
      render: (tenant) => formatDateTime(tenant.createdAt),
    },
  ];

  return (
    <div>
      <PageHeader
        title="دليل المستأجرين"
        description="عرض مؤسسات المنصة وحالات دورة حياتها على مستوى المنصة فقط."
      />

      <FilterBar onReset={hasFilters ? resetFilters : undefined}>
        <SearchInput
          label="بحث عن مستأجر"
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => {
            setPage(1);
            setSearch(searchInput.trim());
          }}
          placeholder="الاسم أو المعرّف…"
        />
        <label className="ds-field">
          <span className="ds-label">حالة دورة الحياة</span>
          <select
            className="ds-select"
            value={lifecycleStatus}
            onChange={(event) => {
              setPage(1);
              setLifecycleStatus(event.target.value as '' | PlatformTenantLifecycleStatus);
            }}
          >
            {LIFECYCLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </FilterBar>

      <DataTable
        columns={columns}
        data={tenants}
        rowKey={(tenant) => tenant.id}
        loading={loading}
        error={error}
        onRetry={loadTenants}
      />

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
