import { useEffect, useState, useCallback } from 'react';
import { Link, MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { Dialog } from '../../components/admin/AdminUi';
import ComplaintForm from '../../components/ComplaintForm';
import SuccessPage from '../SuccessPage';
import type { SubmittedComplaint } from '../../api/complaintApi';
import { useAuth } from '../../context/AuthContext';
import { OrganizationProvider } from '../../context/OrganizationContext';
import {
  fetchComplaints,
  type AdminComplaint,
  type PaginationInfo,
  type ComplaintStatus,
  type SlaStatus,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { formatDate, formatDateTime } from '../../utils/dateTime';
import { AlertTriangle } from 'lucide-react';

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: 'جديد',
  in_review: 'قيد المراجعة',
  resolved: 'تم الحل',
  closed: 'مغلق',
  rejected: 'مرفوض',
};



const SLA_STATUS_LABELS: Record<SlaStatus, { label: string; tone: string }> = {
  on_track: { label: 'ضمن المهلة', tone: 'on_track' },
  overdue: { label: 'متأخر', tone: 'overdue' },
  met: { label: 'تم الالتزام', tone: 'met' },
  none: { label: '-', tone: 'none' },
};

export default function ComplaintListPage() {
  const { currentOrganization } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedComplaint | null>(null);
  const [complaints, setComplaints] = useState<AdminComplaint[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
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
    (setter: React.Dispatch<React.SetStateAction<string>>, paramName: string) =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setter(val);
      setPage(1);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set(paramName, val); else next.delete(paramName);
        next.delete('page');
        return next;
      }, { replace: true });
    };

  return (
    <div>
      <div className="cd-page-head">
        <h1 className="admin-page-title">صندوق الشكاوى والمقترحات</h1>
        <div className="admin-page-actions">
          <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>إضافة شكوى</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card cl-card">
        <div className="card__body cl-filter-row">
          <div className="field cl-filter-field">
            <label htmlFor="statusFilter">الحالة</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={handleFilterChange(setStatusFilter, 'status')}
            >
              <option value="">الكل</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="field cl-filter-field">
            <label htmlFor="isSensitiveFilter">مستوى الحساسية</label>
            <select
              id="isSensitiveFilter"
              value={isSensitiveFilter}
              onChange={handleFilterChange(setIsSensitiveFilter, 'sensitive')}
            >
              <option value="">الكل</option>
              <option value="true">حساس فقط</option>
              <option value="false">غير حساس فقط</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger cl-alert">{error}</div>}

      {/* Table */}
      <div className="card">
        <div className="cl-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الرقم المرجعي</th>
                <th>النوع</th>
                <th>التصنيف</th>
                <th>الأولوية</th>
                <th>تاريخ الإنشاء</th>
                <th>التعيين</th>
                <th>SLA</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading && complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cl-empty">
                    جاري التحميل...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="cl-empty"
                  >
                    لا توجد طلبات تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                complaints.map((item) => {

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
                          <span className="admin-badge admin-badge--danger cl-sens-badge">
                            <AlertTriangle size={12} aria-hidden="true" /> حساس
                          </span>
                        )}
                      </td>
                      <td>{item.type === 'complaint' ? 'شكوى' : 'مقترح'}</td>
                      <td>{item.categoryItem?.labelAr || '-'}</td>
                      <td>{item.priorityItem?.labelAr || '-'}</td>
                      <td title={formatDateTime(item.createdAt)}>{formatDate(item.createdAt)}</td>
                      <td>
                        {item.assignedTo
                          ? item.assignedTo.fullName
                          : item.assignedToOrganization
                            ? `قسم: ${item.assignedToOrganization.name}`
                            : <span className="admin-muted">غير معيّن</span>}
                      </td>
                      <td>
                        <span className={"cd-sla cs-" + slaInfo.tone}>
                          {slaInfo.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className={"admin-status-badge cd-status cs-" + item.status}
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

      {isFormOpen && currentOrganization?.shortName && (
        <Dialog
          title={submitted ? 'تم تسجيل الطلب بنجاح' : 'إضافة شكوى / مقترح'}
          onClose={() => {
            setIsFormOpen(false);
            setSubmitted(null);
          }}
        >
          {submitted ? (
            <SuccessPage
              referenceCode={submitted.referenceCode}
              trackingPin={submitted.trackingPin}
              onReset={() => {
                setIsFormOpen(false);
                setSubmitted(null);
                loadComplaints();
              }}
            />
          ) : (
            <MemoryRouter initialEntries={[`/${currentOrganization.shortName}`]}>
              <Routes>
                <Route
                  path="/:orgSlug"
                  element={
                    <OrganizationProvider>
                      <ComplaintForm
                        onSuccess={(result) => {
                          setSubmitted(result);
                          loadComplaints();
                        }}
                      />
                    </OrganizationProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          )}
        </Dialog>
      )}
    </div>
  );
}
