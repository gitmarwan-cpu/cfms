import { useEffect, useState } from 'react';
import { fetchAuditLogs, type AuditLog, type PaginationInfo } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { PageHeader } from '../../components/patterns/PageHeader';
import DataTable, { type DataTableColumn } from '../../components/admin/ui/DataTable';
import { Drawer } from '../../components/ui/Drawer';
import FilterBar from '../../components/patterns/FilterBar';
import { formatDateTime } from '../../utils/dateTime';
import { Eye, FilterX } from 'lucide-react';

const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'كل الأنواع' },
  { value: 'complaint', label: 'الطلب' },
  { value: 'user', label: 'المستخدم' },
  { value: 'user_organization', label: 'عضوية المستخدم' },
  { value: 'user_role', label: 'تعيين دور' },
  { value: 'role', label: 'الدور' },
  { value: 'organization', label: 'المؤسسة' },
  { value: 'organization_node', label: 'الوحدة التنظيمية' },
  { value: 'reference_item', label: 'البيانات المرجعية' },
  { value: 'notification', label: 'الإشعار' },
  { value: 'sla_rule', label: 'قاعدة SLA' },
];

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const hasFilters = entityType !== '' || entityId.trim() !== '';

  const load = () => {
    setLoading(true);
    setError('');
    fetchAuditLogs({
      page,
      limit: 50,
      entityType: entityType || undefined,
      entityId: entityId.trim() || undefined,
    })
      .then((res) => {
        setItems(res.data);
        setPagination(res.pagination);
      })
      .catch((err: ApiClientError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, entityType, entityId]);

  const resetFilters = () => {
    setPage(1);
    setEntityType('');
    setEntityId('');
  };

  const COLUMNS: DataTableColumn<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'التاريخ',
      sortable: true,
      render: (row) => <span className="au-time">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: 'المستخدم',
      render: (row) => row.actor?.fullName || <span className="admin-muted">النظام</span>,
    },
    {
      key: 'action',
      header: 'العملية',
      render: (row) => <code dir="ltr" className="au-code">{row.action}</code>,
    },
    {
      key: 'entityType',
      header: 'الكيان',
      render: (row) => <code dir="ltr" className="au-code">{row.entityType}</code>,
    },
    {
      key: 'entityId',
      header: 'المعرف',
      render: (row) => row.entityId ?? '—',
    },
    {
      key: 'detail',
      header: '',
      render: (row) => (
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--sm"
          onClick={() => setDetail(row)}
          aria-label={`عرض تفاصيل سجل ${row.action}`}
          title="عرض التفاصيل"
        >
          <Eye size={15} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="سجل التدقيق"
        description="سجل قراءة فقط للعمليات الواقعة ضمن المؤسسة — لا يمكن تعديله أو حذفه."
      />
      <FilterBar onReset={hasFilters ? resetFilters : undefined} resetLabel="مسح عوامل التصفية">
        <label className="field au-filter-field">
          <span className="au-filter-label">نوع الكيان</span>
          <select
            value={entityType}
            onChange={(event) => {
              setPage(1);
              setEntityType(event.target.value);
            }}
          >
            {ENTITY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field au-filter-field">
          <span className="au-filter-label">معرّف الكيان</span>
          <input
            dir="ltr"
            value={entityId}
            onChange={(event) => {
              setPage(1);
              setEntityId(event.target.value);
            }}
            placeholder="مثال: 42"
            inputMode="numeric"
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            className="ds-btn ds-btn--outline ds-btn--sm au-filter-clear"
            onClick={resetFilters}
          >
            <FilterX size={14} aria-hidden="true" />
          </button>
        )}
      </FilterBar>
      <DataTable
        columns={COLUMNS}
        data={items}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={load}
        pagination={pagination && pagination.totalPages > 1 ? { page, totalPages: pagination.totalPages, onPageChange: setPage } : null}
      />
      <Drawer
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title="تفاصيل سجل التدقيق"
        description={detail ? `#${detail.id} — ${detail.action}` : undefined}
      >
        {detail && (
          <div className="au-detail">
            <div className="admin-detail-fields">
              <div>
                <div className="admin-detail-label">التاريخ والوقت</div>
                <div className="admin-detail-value au-detail-time">{formatDateTime(detail.createdAt)}</div>
              </div>
              <div>
                <div className="admin-detail-label">المستخدم</div>
                <div className="admin-detail-value">{detail.actor?.fullName || <span className="admin-muted">النظام</span>}</div>
              </div>
              <div>
                <div className="admin-detail-label">العملية</div>
                <div className="admin-detail-value"><code dir="ltr" className="au-code">{detail.action}</code></div>
              </div>
              <div>
                <div className="admin-detail-label">الكيان</div>
                <div className="admin-detail-value"><code dir="ltr" className="au-code">{detail.entityType}</code></div>
              </div>
              <div>
                <div className="admin-detail-label">معرّف الكيان</div>
                <div className="admin-detail-value">{detail.entityId ?? '—'}</div>
              </div>
            </div>
            <div className="au-meta">
              <div className="admin-detail-label">بيانات العملية</div>
              <pre dir="ltr" className="au-meta-pre">{JSON.stringify(detail.metadata ?? {}, null, 2)}</pre>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}