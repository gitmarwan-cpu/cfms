import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchComplaints,
  type AdminComplaint,
  type PaginationInfo,
  type ComplaintStatus,
  type SlaStatus,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: 'جديد',
  in_review: 'قيد المراجعة',
  resolved: 'تم الحل',
  closed: 'مغلق',
  rejected: 'مرفوض',
};

const STATUS_COLORS: Record<ComplaintStatus, { bg: string; text: string }> = {
  new: { bg: '#dbeafe', text: '#1e40af' },
  in_review: { bg: '#fef3c7', text: '#92400e' },
  resolved: { bg: '#d1fae5', text: '#065f46' },
  closed: { bg: '#e2e8f0', text: '#374151' },
  rejected: { bg: '#fecaca', text: '#991b1b' },
};

const SLA_STATUS_LABELS: Record<SlaStatus, { label: string; color: string }> = {
  on_track: { label: 'ضمن المهلة', color: 'var(--color-success)' },
  overdue: { label: 'متأخر', color: 'var(--color-danger)' },
  met: { label: 'تم الالتزام', color: 'var(--color-primary)' },
  none: { label: '-', color: 'var(--color-text-muted)' },
};

export default function ComplaintListPage() {
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [isSensitiveFilter, setIsSensitiveFilter] = useState('');

  const loadComplaints = useCallback(() => {
    setLoading(true);
    setError('');

    fetchComplaints({
      page,
      limit: 15,
      ...(statusFilter ? { status: statusFilter as ComplaintStatus } : {}),
      ...(isSensitiveFilter !== '' ? { isSensitive: isSensitiveFilter === 'true' } : {}),
    })
      .then((res) => {
        setComplaints(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => {
        const apiErr = err as ApiClientError;
        setError(apiErr.message || 'حدث خطأ أثناء جلب الطلبات');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, statusFilter, isSensitiveFilter]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const handleFilterChange =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="admin-page-title">صندوق الشكاوى والمقترحات</h1>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card__body" style={{ padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1', minWidth: '150px' }}>
            <label htmlFor="statusFilter">الحالة</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={handleFilterChange(setStatusFilter)}
            >
              <option value="">الكل</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: '1', minWidth: '150px' }}>
            <label htmlFor="isSensitiveFilter">مستوى الحساسية</label>
            <select
              id="isSensitiveFilter"
              value={isSensitiveFilter}
              onChange={handleFilterChange(setIsSensitiveFilter)}
            >
              <option value="">الكل</option>
              <option value="true">حساس فقط</option>
              <option value="false">غير حساس فقط</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>الرقم المرجعي</th>
                <th>النوع</th>
                <th>التصنيف</th>
                <th>الأولوية</th>
                <th>تاريخ التقديم</th>
                <th>التعيين</th>
                <th>SLA</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading && complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center' }}>
                    جاري التحميل...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)' }}
                  >
                    لا توجد طلبات تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                complaints.map((item) => {
                  const statusStyle = STATUS_COLORS[item.status] || { bg: '#f3f4f6', text: '#374151' };
                  const slaInfo = SLA_STATUS_LABELS[item.slaStatus] || SLA_STATUS_LABELS.none;
                  return (
                    <tr
                      key={item.id}
                      className={item.isSensitive ? 'admin-table__row--sensitive' : ''}
                    >
                      <td>
                        <Link
                          to={`/admin/complaints/${item.id}`}
                          className="admin-table__link"
                        >
                          {item.referenceCode}
                        </Link>
                        {item.isSensitive && (
                          <span className="admin-badge admin-badge--danger" style={{ marginInlineStart: '8px' }}>
                            ⚠️ حساس
                          </span>
                        )}
                      </td>
                      <td>{item.type === 'complaint' ? 'شكوى' : 'مقترح'}</td>
                      <td>{item.categoryItem?.labelAr || '-'}</td>
                      <td>{item.priorityItem?.labelAr || '-'}</td>
                      <td>{new Date(item.createdAt).toLocaleDateString('ar')}</td>
                      <td>
                        {item.assignedTo
                          ? item.assignedTo.fullName
                          : item.assignedToOrgUnit
                            ? `قسم: ${item.assignedToOrgUnit.name}`
                            : <span style={{ color: 'var(--color-text-muted)' }}>غير معيّن</span>}
                      </td>
                      <td>
                        <span style={{ color: slaInfo.color, fontWeight: 500, fontSize: '12px' }}>
                          {slaInfo.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className="admin-status-badge"
                          style={{ background: statusStyle.bg, color: statusStyle.text }}
                        >
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="admin-pagination">
            <button
              className="btn admin-pagination__btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              السابق
            </button>
            <span className="admin-pagination__info">
              صفحة {page} من {pagination.totalPages}
            </span>
            <button
              className="btn admin-pagination__btn"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
