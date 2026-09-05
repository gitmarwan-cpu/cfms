import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
import SearchInput from '../../components/patterns/SearchInput';
import Pagination from '../../components/patterns/Pagination';
import { RegeneratePinAction } from '../../components/admin/ui/RegeneratePinAction';

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredComplaints = complaints.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const refMatch = item.referenceCode?.toLowerCase().includes(q);
    const nameMatch = !item.isAnonymous && item.consentGiven && item.complainant?.fullName?.toLowerCase().includes(q);
    return refMatch || nameMatch;
  });

  return (
    <div>
      <div className="cd-page-head">
        <h1 className="admin-page-title">صندوق الشكاوى والمقترحات</h1>
        <div className="admin-page-actions">
          {currentOrganization?.slug && (
            <Link to={`/${currentOrganization.slug}`} className="btn btn-primary">
              إضافة شكوى
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card cl-card">
        <div className="card__body cl-filter-row flex flex-wrap gap-4 items-end">
          <SearchInput
            className="flex-1 min-w-[240px]"
            label="البحث"
            placeholder="ابحث برقم المرجع، رمز المتابعة، أو الاسم..."
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setPage(1); }}
          />
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
          <table className="admin-table w-full table-auto">
            <thead>
              <tr>
                <th className="w-[15%] min-w-[140px] whitespace-nowrap">الرقم المرجعي</th>
                <th className="w-[12%] min-w-[110px] whitespace-nowrap">رمز المتابعة</th>
                <th className="w-[23%] min-w-[160px]">مقدم الطلب</th>
                <th className="w-[10%] min-w-[80px] whitespace-nowrap">النوع</th>
                <th className="w-[15%] min-w-[140px]">التصنيف</th>
                <th className="w-[10%] min-w-[100px] whitespace-nowrap">الحالة</th>
                <th className="w-[10%] min-w-[100px] whitespace-nowrap">تاريخ الإنشاء</th>
                <th className="w-[5%] min-w-[80px] whitespace-nowrap">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && complaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="cl-empty">
                    جاري التحميل...
                  </td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="cl-empty"
                  >
                    لا توجد طلبات تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className={item.isSensitive ? 'admin-table__row--sensitive' : ''}
                    >
                      <td className="whitespace-nowrap">
                        <Link
                          to={`/admin/complaints/${item.id}`}
                          className="admin-table__link"
                        >
                          {item.referenceCode}
                        </Link>
                        {item.isSensitive && (
                          <span className="admin-badge admin-badge--danger cl-sens-badge ms-2">
                            <AlertTriangle size={12} aria-hidden="true" /> حساس
                          </span>
                        )}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <div className="flex justify-center">
                          <RegeneratePinAction complaintId={item.id} onSuccess={loadComplaints} />
                        </div>
                      </td>
                      <td className="truncate max-w-[200px]">
                        {item.isAnonymous || !item.consentGiven
                          ? <span className="admin-muted italic">سري</span>
                          : <span className="font-medium">{item.complainant?.fullName || '-'}</span>}
                      </td>
                      <td className="whitespace-nowrap">{item.type === 'complaint' ? 'شكوى' : 'مقترح'}</td>
                      <td className="truncate max-w-[180px]">{item.categoryItem?.labelAr || '-'}</td>
                      <td className="whitespace-nowrap">
                        <span
                          className={"admin-status-badge cd-status cs-" + item.status}
                        >
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-sm" title={formatDateTime(item.createdAt)}>{formatDate(item.createdAt)}</td>
                      <td className="whitespace-nowrap text-left">
                        <Link to={`/admin/complaints/${item.id}`} className="btn btn-secondary btn-sm">
                          عرض
                        </Link>
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
          <div className="admin-pagination flex justify-center py-4">
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
