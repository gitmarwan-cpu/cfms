import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Layers,
  ListChecks,
  Plus,
  RefreshCw,
  Settings,
  Users,
  XCircle,
} from 'lucide-react';
import { fetchReportData, fetchComplaints } from '../../api/adminApi';
import type { AdminComplaint, ReportData } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { PageHeader } from '../../components/patterns/PageHeader';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';
import { formatDate } from '../../utils/dateTime';

// ── Helpers ──────────────────────────────────────────────────────────

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

const FINAL_STATUS = new Set(['resolved', 'closed', 'rejected']);

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'جديد',          color: '#2c6e8f', bg: '#e8f4fb' },
  in_review: { label: 'قيد المراجعة', color: '#92600a', bg: '#fef3c7' },
  resolved:  { label: 'تم الحل',       color: '#1a7f4e', bg: '#dcfce7' },
  closed:    { label: 'مغلق',          color: '#5b6b6c', bg: '#f1f5f9' },
  rejected:  { label: 'مرفوض',        color: '#b3261e', bg: '#fbeceb' },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, color: '#5b6b6c', bg: '#f1f5f9' };
}

function toneFor(code: string): StatusTone {
  const c = code.toLowerCase();
  if (c === 'new' || c === 'in_review') return 'warning';
  if (c === 'resolved') return 'success';
  if (c === 'rejected') return 'danger';
  if (FINAL_STATUS.has(c)) return 'neutral';
  return 'info';
}

// ── Skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('dv2-skeleton', className)} aria-hidden />;
}

// ── KPI Card ─────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  to?: string;
  tone?: StatusTone | 'primary';
  sub?: string;
  loading?: boolean;
}

function KpiCard({ label, value, icon, to, tone = 'primary', sub, loading }: KpiProps) {
  const inner = (
    <div className={cn('dv2-kpi', to && 'dv2-kpi--clickable', `dv2-kpi--${tone}`)}>
      <span className="dv2-kpi__icon">{icon}</span>
      <span className="dv2-kpi__body">
        {loading ? (
          <>
            <Skeleton className="dv2-skeleton--val" />
            <Skeleton className="dv2-skeleton--lbl" />
          </>
        ) : (
          <>
            <span className="dv2-kpi__value">{value}</span>
            <span className="dv2-kpi__label">{label}</span>
            {sub && <span className="dv2-kpi__sub">{sub}</span>}
          </>
        )}
      </span>
      {to && !loading && (
        <ArrowLeft size={14} className="dv2-kpi__arrow" aria-hidden />
      )}
    </div>
  );

  if (to && !loading) {
    return (
      <Link to={to} className="dv2-kpi-link" aria-label={label}>
        {inner}
      </Link>
    );
  }
  return inner;
}

// ── Panel wrapper ─────────────────────────────────────────────────────

function Panel({ title, icon, children, className, action }: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn('dv2-panel', className)}>
      <header className="dv2-panel__head">
        <h2 className="dv2-panel__title">
          {icon && <span className="dv2-panel__icon" aria-hidden>{icon}</span>}
          {title}
        </h2>
        {action}
      </header>
      <div className="dv2-panel__body">{children}</div>
    </section>
  );
}

// ── SVG Bar Chart (trend) ─────────────────────────────────────────────

const formatMonth = (isoDate: string) => {
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return isoDate;
  }
};

function TrendChart({ data }: { data: Array<{ period: string; total: number }> }) {
  const shown = data.slice(-12);
  if (shown.length === 0) return <EmptyState title="لا توجد بيانات شهرية." icon={BarChart3} />;
  const maxVal = Math.max(1, ...shown.map((d) => d.total));
  const W = 560;
  const H = 140;
  const padLeft = 28;
  const padBottom = 28;
  const padRight = 8;
  const padTop = 24;
  const chartW = W - padLeft - padRight;
  const chartH = H - padBottom - padTop;
  const barW = Math.max(8, (chartW / shown.length) * 0.25);
  const gap = chartW / shown.length;

  const points = shown.map((d, i) => {
    const x = padLeft + gap * i + gap / 2;
    const y = padTop + chartH - ((d.total / maxVal) * chartH);
    return { x, y, d };
  });

  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0]!.x} ${points[0]!.y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const cpX = prev.x + (curr.x - prev.x) / 2;
      pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  }

  return (
    <div className="dv2-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="dv2-chart-svg"
        role="img"
        aria-label="مخطط خطي للشكاوى الشهرية"
      >
        {/* Y-axis guides */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padTop + chartH * (1 - t);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                x2={W - padRight}
                y1={y}
                y2={y}
                stroke="var(--color-border, #e2e8f0)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padLeft - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-text-muted, #94a3b8)"
              >
                {Math.round(maxVal * t)}
              </text>
            </g>
          );
        })}

        {/* Line */}
        {points.length > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--color-primary, #0e5f66)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dv2-chart-line"
          />
        )}

        {/* Points & Labels */}
        {points.map(({ x, y, d }) => (
          <g key={d.period} className="dv2-chart-point">
            <circle
              cx={x}
              cy={y}
              r={4}
              fill="var(--color-surface, #ffffff)"
              stroke="var(--color-primary, #0e5f66)"
              strokeWidth={2}
            />
            <text
              x={x}
              y={H - padBottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-text-muted, #94a3b8)"
            >
              {formatMonth(d.period)}
            </text>
            <title>{formatMonth(d.period)}: {num(d.total)} شكوى</title>
            <text
              x={x}
              y={y - 10}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-primary, #0e5f66)"
              fontWeight="600"
            >
              {num(d.total)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── SVG Donut Chart (by status) ───────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new:       '#2c6e8f',
  in_review: '#d97706',
  resolved:  '#16a34a',
  closed:    '#6b7280',
  rejected:  '#dc2626',
};

function DonutChart({ data }: { data: Array<{ status: string; total: number }> }) {
  if (data.length === 0) return <EmptyState title="لا توجد بيانات حالات." icon={ListChecks} />;
  const total = data.reduce((s, d) => s + num(d.total), 0);
  if (total === 0) return <EmptyState title="لا توجد بيانات حالات." icon={ListChecks} />;

  const R = 54;
  const CX = 68;
  const CY = 68;
  const strokeW = 22;

  let cumPct = 0;
  const slices = data.map((d) => {
    const pct = num(d.total) / total;
    const start = cumPct;
    cumPct += pct;
    return { ...d, pct, start, color: STATUS_COLORS[d.status] ?? '#94a3b8' };
  });

  function describeArc(start: number, pct: number) {
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = (start + pct) * 2 * Math.PI - Math.PI / 2;
    const laf = pct > 0.5 ? 1 : 0;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    if (pct >= 0.9999) {
      // Full circle
      return `M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX - 0.001} ${CY - R} Z`;
    }
    return `M ${x1} ${y1} A ${R} ${R} 0 ${laf} 1 ${x2} ${y2}`;
  }

  return (
    <div className="dv2-donut-wrap">
      <svg viewBox="0 0 136 136" className="dv2-donut-svg" role="img" aria-label="توزيع الشكاوى حسب الحالة">
        {slices.map((s) => (
          <path
            key={s.status}
            d={describeArc(s.start, s.pct)}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
          />
        ))}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize={20} fontWeight="700" fill="#1c2b2c">
          {total}
        </text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize={10} fill="#5b6b6c">
          إجمالي
        </text>
      </svg>
      <ul className="dv2-donut-legend">
        {slices.map((s) => (
          <li key={s.status} className="dv2-donut-item">
            <span className="dv2-donut-dot" style={{ background: s.color }} />
            <Link
              to={`/admin/complaints?status=${encodeURIComponent(s.status)}`}
              className="dv2-donut-label"
            >
              {statusMeta(s.status).label}
            </Link>
            <span className="dv2-donut-count">{num(s.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Category Bars ─────────────────────────────────────────────────────

function CategoryBars({
  data,
}: {
  data: Array<{ code: string; labelAr: string; total: number }>;
}) {
  const top = [...data].sort((a, b) => num(b.total) - num(a.total)).slice(0, 7);
  if (top.length === 0) return <EmptyState title="لا توجد بيانات تصنيفات." icon={Layers} />;
  const max = Math.max(1, ...top.map((d) => num(d.total)));
  return (
    <ul className="dv2-catbars">
      {top.map((d) => (
        <li key={d.code} className="dv2-catbar-row">
          <span className="dv2-catbar-label" title={d.labelAr}>{d.labelAr}</span>
          <span className="dv2-catbar-track">
            <span
              className="dv2-catbar-fill"
              style={{ width: `${Math.round((num(d.total) / max) * 100)}%` }}
            />
          </span>
          <span className="dv2-catbar-count">{num(d.total)}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Recent Complaints table ───────────────────────────────────────────

function RecentComplaints({ complaints, loading }: { complaints: AdminComplaint[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="dv2-recent-skels">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="dv2-skeleton--row" />
        ))}
      </div>
    );
  }
  if (complaints.length === 0) {
    return <EmptyState title="لا توجد طلبات حديثة." icon={FileText} />;
  }
  return (
    <div className="dv2-recent-scroll">
      <table className="dv2-recent-table">
        <thead>
          <tr>
            <th>الرقم المرجعي</th>
            <th>النوع</th>
            <th>التصنيف</th>
            <th>الأولوية</th>
            <th>تاريخ الإنشاء</th>
            <th>التعيين</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map((c) => {
            const sm = statusMeta(c.status);
            return (
              <tr key={c.id} className={c.isSensitive ? 'dv2-recent-row--sensitive' : ''}>
                <td>
                  <Link to={`/admin/complaints/${c.id}`} className="dv2-recent-ref">
                    {c.referenceCode}
                  </Link>
                  {c.isSensitive && (
                    <span className="dv2-sens-badge" title="حساس">
                      <AlertTriangle size={10} aria-hidden />
                    </span>
                  )}
                </td>
                <td>{c.type === 'complaint' ? 'شكوى' : 'مقترح'}</td>
                <td>{c.categoryItem?.labelAr ?? <span className="dv2-muted">—</span>}</td>
                <td>{c.priorityItem?.labelAr ?? <span className="dv2-muted">—</span>}</td>
                <td>{formatDate(c.createdAt)}</td>
                <td>
                  {c.assignedTo?.fullName
                    ?? (c.assignedToOrganization ? c.assignedToOrganization.name : <span className="dv2-muted">غير معيّن</span>)}
                </td>
                <td>
                  <StatusBadge tone={toneFor(c.status)} noIcon>
                    {sm.label}
                  </StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Date Range Filter ─────────────────────────────────────────────────

const PRESETS = [
  { label: 'آخر 7 أيام',   days: 7 },
  { label: 'آخر 30 يوماً', days: 30 },
  { label: 'آخر 90 يوماً', days: 90 },
  { label: 'هذا العام',    days: 365 },
];

function toIso(d: Date): string {
  return d.toISOString().substring(0, 10);
}

// ── Main Dashboard ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentOrganization } = useAuth();
  const [report, setReport] = useState<ReportData | null>(null);
  const [recent, setRecent] = useState<AdminComplaint[]>([]);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [error, setError] = useState('');

  // Date filter
  const [activePreset, setActivePreset] = useState<number | null>(30);
  const [from, setFrom] = useState<string>(() => toIso(new Date(Date.now() - 30 * 86400_000)));
  const [to, setTo] = useState<string>(() => toIso(new Date()));

  const applyPreset = (days: number) => {
    setActivePreset(days);
    setFrom(toIso(new Date(Date.now() - days * 86400_000)));
    setTo(toIso(new Date()));
  };

  const loadReport = useCallback(() => {
    setLoadingReport(true);
    setError('');
    fetchReportData(from, to)
      .then((r) => setReport(r))
      .catch((e: ApiClientError) => setError(e.message || 'تعذر تحميل البيانات.'))
      .finally(() => setLoadingReport(false));
  }, [from, to]);

  const loadRecent = useCallback(() => {
    setLoadingRecent(true);
    fetchComplaints({ page: 1, limit: 8 })
      .then((r) => setRecent(r.data))
      .catch(() => {/* non-critical */})
      .finally(() => setLoadingRecent(false));
  }, []);

  useEffect(() => { loadReport(); }, [loadReport]);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  // Derived
  const byStatus  = report?.byStatus   ?? [];
  const byCategory = report?.byCategory ?? [];
  const byMonth   = report?.byMonth    ?? [];
  const summary   = report?.summary;
  const total     = num(summary?.total ?? byStatus.reduce((a, s) => a + num(s.total), 0));
  const openCount = byStatus.filter((s) => !FINAL_STATUS.has(String(s.status).toLowerCase())).reduce((a, s) => a + num(s.total), 0);
  const doneCount = total - openCount;

  // Build KPI list from real per-status data
  const statusKpis = byStatus.map((s) => ({
    label: statusMeta(String(s.status)).label,
    value: num(s.total),
    tone: toneFor(String(s.status)),
    to: `/admin/complaints?status=${encodeURIComponent(String(s.status))}`,
    icon: FINAL_STATUS.has(String(s.status).toLowerCase())
      ? <CheckCircle2 size={18} />
      : <Clock3 size={18} />,
  }));

  const QUICK_ACTIONS = [
    { to: '/admin/complaints', label: 'الشكاوى',         icon: <FileText size={16} />,    desc: `${total} إجمالي` },
    { to: '/admin/users',      label: 'المستخدمون',      icon: <Users size={16} />,       desc: '' },
    { to: '/admin/roles',      label: 'الأدوار',          icon: <Layers size={16} />,      desc: '' },
    { to: '/admin/organization', label: 'المؤسسة',       icon: <Settings size={16} />,    desc: '' },
  ];

  return (
    <>
      <PageHeader
        title="لوحة المعلومات"
        description="نظرة تشغيلية عامة على نشاط الشكاوى في مؤسستك."
      />

      {/* ── Filter Bar ── */}
      <div className="dv2-filterbar">
        <div className="dv2-filterbar__presets">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={cn('dv2-preset-btn', activePreset === p.days && 'dv2-preset-btn--active')}
              onClick={() => applyPreset(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="dv2-filterbar__custom">
          <label className="dv2-date-field">
            <span>من</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(null); }}
              className="dv2-date-input"
            />
          </label>
          <label className="dv2-date-field">
            <span>إلى</span>
            <input
              type="date"
              value={to}
              min={from}
              max={toIso(new Date())}
              onChange={(e) => { setTo(e.target.value); setActivePreset(null); }}
              className="dv2-date-input"
            />
          </label>
          <Button variant="outline" size="icon" onClick={loadReport} aria-label="تحديث" className="dv2-refresh-btn">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="dv2-error" role="alert">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={loadReport}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="dv2-kpi-row">
        <KpiCard
          label="إجمالي الشكاوى"
          value={total}
          icon={<ListChecks size={18} />}
          to="/admin/complaints"
          tone="primary"
          loading={loadingReport}
        />
        <KpiCard
          label="قيد المعالجة"
          value={openCount}
          icon={<Clock3 size={18} />}
          tone="warning"
          loading={loadingReport}
          sub={total > 0 ? `${Math.round((openCount / total) * 100)}٪ من الإجمالي` : undefined}
        />
        <KpiCard
          label="منتهية"
          value={doneCount}
          icon={<CheckCircle2 size={18} />}
          tone="success"
          loading={loadingReport}
          sub={total > 0 ? `${Math.round((doneCount / total) * 100)}٪ من الإجمالي` : undefined}
        />
        {summary?.sensitive != null && num(summary.sensitive) > 0 && (
          <KpiCard
            label="حساسة"
            value={num(summary.sensitive)}
            icon={<AlertTriangle size={18} />}
            to="/admin/complaints?sensitive=true"
            tone="danger"
            loading={loadingReport}
          />
        )}
        {summary?.unassigned != null && (
          <KpiCard
            label="غير مُعيَّن"
            value={num(summary.unassigned)}
            icon={<XCircle size={18} />}
            tone="neutral"
            loading={loadingReport}
          />
        )}
        {statusKpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            to={k.to}
            tone={k.tone}
            loading={loadingReport}
          />
        ))}
      </div>

      {/* ── Charts + Quick Actions grid ── */}
      <div className="dv2-main-grid">

        {/* Trend chart */}
        <Panel
          title="الشكاوى عبر الأشهر"
          icon={<BarChart3 size={15} />}
          className="dv2-panel--trend"
        >
          {loadingReport
            ? <Skeleton className="dv2-skeleton--chart" />
            : <TrendChart data={byMonth} />}
        </Panel>

        {/* Status donut */}
        <Panel
          title="توزيع الحالات"
          icon={<ListChecks size={15} />}
          className="dv2-panel--donut"
        >
          {loadingReport
            ? <Skeleton className="dv2-skeleton--chart" />
            : <DonutChart data={byStatus} />}
        </Panel>

        {/* Category breakdown */}
        <Panel
          title="أكثر التصنيفات نشاطاً"
          icon={<Layers size={15} />}
          className="dv2-panel--cats"
        >
          {loadingReport
            ? <Skeleton className="dv2-skeleton--chart" />
            : <CategoryBars data={byCategory} />}
        </Panel>

        {/* Quick Actions */}
        <Panel
          title="إجراءات سريعة"
          className="dv2-panel--actions"
        >
          <div className="dv2-actions-grid">
            {currentOrganization?.slug && (
              <Link to={`/${currentOrganization.slug}`} className="dv2-action-btn dv2-action-btn--primary">
                <Plus size={16} aria-hidden />
                إضافة شكوى
              </Link>
            )}
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.to} to={a.to} className="dv2-action-link">
                <span className="dv2-action-link__icon">{a.icon}</span>
                <span className="dv2-action-link__label">{a.label}</span>
                {a.desc && <span className="dv2-action-link__desc">{a.desc}</span>}
                <ArrowLeft size={13} className="dv2-action-link__arrow" aria-hidden />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Recent Complaints ── */}
      <Panel
        title="أحدث الطلبات"
        icon={<FileText size={15} />}
        className="dv2-panel--recent"
        action={
          <Link to="/admin/complaints" className="dv2-see-all">
            عرض الكل
            <ArrowLeft size={13} aria-hidden />
          </Link>
        }
      >
        <RecentComplaints complaints={recent} loading={loadingRecent} />
      </Panel>
    </>
  );
}