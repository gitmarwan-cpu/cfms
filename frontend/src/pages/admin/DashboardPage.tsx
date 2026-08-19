import { useEffect, useState } from 'react';
import { fetchReportData, type ReportData } from '../../api/adminApi';
import { Link } from 'react-router-dom';

const STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  in_review: 'قيد المراجعة',
  resolved: 'تم الحل',
  closed: 'مغلق',
  rejected: 'مرفوض',
};

const STATUS_CARD_COLORS: Record<string, string> = {
  new: '#3b82f6',
  in_review: '#f59e0b',
  resolved: '#10b981',
  closed: '#6b7280',
  rejected: '#ef4444',
};

function getStatusCount(byStatus: ReportData['byStatus'], status: string): number {
  return byStatus.find((s) => s.status === status)?.total ?? 0;
}

export default function DashboardPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetchReportData()
      .then((data) => {
        if (isMounted) setReport(data);
      })
      .catch(() => {
        if (isMounted) setError('حدث خطأ أثناء تحميل إحصائيات لوحة القيادة');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>جاري التحميل...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!report) return null;

  const maxMonthTotal = Math.max(...report.byMonth.map((m) => m.total), 1);

  return (
    <div>
      <h1 className="admin-page-title">لوحة القيادة</h1>

      {/* Summary Cards */}
      <div className="admin-stats-grid">
        <div className="card admin-stat-card" style={{ borderInlineStart: '4px solid var(--color-primary)' }}>
          <div className="admin-stat-card__label">إجمالي الطلبات</div>
          <div className="admin-stat-card__value">{report.summary.total}</div>
        </div>
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div
            key={status}
            className="card admin-stat-card"
            style={{ borderInlineStart: `4px solid ${STATUS_CARD_COLORS[status] || '#6b7280'}` }}
          >
            <div className="admin-stat-card__label">{label}</div>
            <div className="admin-stat-card__value">{getStatusCount(report.byStatus, status)}</div>
          </div>
        ))}
      </div>

      {/* Second Row: Assignment + Sensitivity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h2 className="admin-section-title">التعيين</h2>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                {report.summary.assigned}
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>معيّنة</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                {report.summary.unassigned}
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>غير معيّنة</div>
            </div>
          </div>
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Link to="/admin/complaints" className="btn btn-outline">عرض الطلبات</Link>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h2 className="admin-section-title">الحساسية</h2>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f97316' }}>
              {report.summary.sensitive}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>طلبات حساسة</div>
          </div>
        </div>
      </div>

      {/* Third Row: Category Breakdown + Monthly Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Category Breakdown */}
        <div className="card" style={{ padding: '20px' }}>
          <h2 className="admin-section-title">توزيع التصنيفات</h2>
          {report.byCategory.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
              لا توجد بيانات
            </div>
          ) : (
            <table className="admin-table admin-table--compact">
              <thead>
                <tr>
                  <th>التصنيف</th>
                  <th style={{ textAlign: 'center' }}>العدد</th>
                </tr>
              </thead>
              <tbody>
                {report.byCategory.map((cat) => (
                  <tr key={cat.itemId}>
                    <td>{cat.labelAr}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{cat.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="card" style={{ padding: '20px' }}>
          <h2 className="admin-section-title">الاتجاه الشهري</h2>
          {report.byMonth.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
              لا توجد بيانات
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '160px', padding: '10px 0' }}>
              {report.byMonth.map((month) => {
                const heightPercent = (month.total / maxMonthTotal) * 100;
                const monthDate = new Date(month.period);
                const monthLabel = monthDate.toLocaleDateString('ar', { month: 'short' });
                return (
                  <div
                    key={month.period}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{month.total}</span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '40px',
                        height: `${Math.max(heightPercent, 4)}%`,
                        background: 'var(--color-primary)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{monthLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
