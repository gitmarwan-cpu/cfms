import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getComplaint,
  updateComplaintStatus,
  updateComplaintAssignment,
  escalateComplaint,
  fetchOrgUnits,
  fetchGroups,
  type AdminComplaintDetail,
  type ComplaintStatus,
  type OrgUnit,
  type Group,
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

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  new: '#dbeafe',
  in_review: '#fef3c7',
  resolved: '#d1fae5',
  closed: '#e2e8f0',
  rejected: '#fecaca',
};

const SLA_STATUS_LABELS: Record<SlaStatus, { label: string; color: string }> = {
  on_track: { label: 'ضمن المهلة', color: 'var(--color-success)' },
  overdue: { label: 'متأخر', color: 'var(--color-danger)' },
  met: { label: 'تم الالتزام', color: 'var(--color-primary)' },
  none: { label: 'غير محدد', color: 'var(--color-text-muted)' },
};

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status update state
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<ComplaintStatus | null>(null);
  const [statusError, setStatusError] = useState('');

  // Assignment state
  const [assignUserId, setAssignUserId] = useState('');
  const [assignOrgUnitId, setAssignOrgUnitId] = useState('');
  const [assignError, setAssignError] = useState('');

  // Escalation state
  const [escalateNote, setEscalateNote] = useState('');
  const [escalateError, setEscalateError] = useState('');

  // Org data for assignment dropdowns
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    getComplaint(Number(id))
      .then(setData)
      .catch((err) => {
        const apiErr = err as ApiClientError;
        if (apiErr.status === 404) {
          setError('لم يتم العثور على الطلب المطلوب');
        } else if (apiErr.status === 403) {
          setError('ليس لديك صلاحية لعرض هذا الطلب');
        } else {
          setError(apiErr.message || 'حدث خطأ أثناء جلب تفاصيل الطلب');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load org structure for assignment dropdowns
  useEffect(() => {
    fetchOrgUnits().then(setOrgUnits).catch(() => {/* Non-critical */});
    fetchGroups().then(setGroups).catch(() => {/* Non-critical */});
  }, []);

  const handleStatusUpdate = async (newStatus: ComplaintStatus) => {
    setStatusError('');
    try {
      const updated = await updateComplaintStatus(Number(id), newStatus, statusUpdateNote || undefined);
      setData(updated);
      setStatusUpdateNote('');
      setUpdatingStatus(null);
    } catch (err) {
      const apiErr = err as ApiClientError;
      setStatusError(apiErr.message || 'حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleAssign = async () => {
    setAssignError('');
    try {
      const updated = await updateComplaintAssignment(
        Number(id),
        assignUserId ? Number(assignUserId) : null,
        assignOrgUnitId ? Number(assignOrgUnitId) : null
      );
      setData(updated);
      setAssignUserId('');
      setAssignOrgUnitId('');
    } catch (err) {
      const apiErr = err as ApiClientError;
      setAssignError(apiErr.message || 'حدث خطأ أثناء التعيين');
    }
  };

  const handleEscalate = async () => {
    setEscalateError('');
    try {
      const updated = await escalateComplaint(Number(id), escalateNote || undefined);
      setData(updated);
      setEscalateNote('');
    } catch (err) {
      const apiErr = err as ApiClientError;
      setEscalateError(apiErr.message || 'حدث خطأ أثناء التصعيد');
    }
  };

  if (loading && !data) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>جاري التحميل...</div>;
  }

  if (error || !data) {
    return (
      <div className="alert alert-danger">
        {error || 'لم يتم العثور على تفاصيل الطلب'}
        <br />
        <Link to="/admin/complaints" style={{ color: 'inherit', marginTop: '8px', display: 'inline-block' }}>
          العودة للصندوق
        </Link>
      </div>
    );
  }

  const slaInfo = SLA_STATUS_LABELS[data.slaStatus] || SLA_STATUS_LABELS.none;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="admin-page-title">طلب {data.referenceCode}</h1>
        <Link to="/admin/complaints" className="btn btn-outline">عودة</Link>
      </div>

      <div className="admin-detail-grid">
        {/* Main Content */}
        <div className="admin-detail-main">
          {/* Basic Info */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>التفاصيل الأساسية</h2>
              <span
                className="admin-status-badge"
                style={{ background: STATUS_COLORS[data.status] || '#f3f4f6' }}
              >
                {STATUS_LABELS[data.status] || data.status}
              </span>
            </div>
            <div className="card__body">
              {data.isSensitive && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span>
                  هذا الطلب مصنف كطلب <strong>حساس</strong>
                </div>
              )}

              <div className="admin-detail-fields">
                <div>
                  <div className="admin-detail-label">النوع</div>
                  <div className="admin-detail-value">{data.type === 'complaint' ? 'شكوى' : 'مقترح'}</div>
                </div>
                <div>
                  <div className="admin-detail-label">التصنيف</div>
                  <div className="admin-detail-value">{data.categoryItem?.labelAr || '-'}</div>
                </div>
                <div>
                  <div className="admin-detail-label">الأولوية</div>
                  <div className="admin-detail-value">{data.priorityItem?.labelAr || '-'}</div>
                </div>
                <div>
                  <div className="admin-detail-label">تاريخ التقديم</div>
                  <div className="admin-detail-value">{new Date(data.createdAt).toLocaleString('ar')}</div>
                </div>
                <div>
                  <div className="admin-detail-label">قناة الاستقبال</div>
                  <div className="admin-detail-value">{data.channelItem?.labelAr || '-'}</div>
                </div>
                <div>
                  <div className="admin-detail-label">مرجع المشروع</div>
                  <div className="admin-detail-value">{data.projectReferenceCode || '-'}</div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginTop: '20px' }}>
                <div className="admin-detail-label">الوصف</div>
                <div className="admin-detail-description">{data.description}</div>
              </div>
              {data.desiredResolution && (
                <div style={{ marginTop: '16px' }}>
                  <div className="admin-detail-label">الحل المطلوب</div>
                  <div className="admin-detail-description">{data.desiredResolution}</div>
                </div>
              )}

              {/* Complainant */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>بيانات المتقدم</h3>
                {data.isAnonymous ? (
                  <div style={{ color: 'var(--color-text-muted)' }}>تقديم مجهول</div>
                ) : (
                  <div className="admin-detail-fields">
                    <div>
                      <div className="admin-detail-label">الاسم</div>
                      <div className="admin-detail-value">{data.complainant?.fullName || '-'}</div>
                    </div>
                    <div>
                      <div className="admin-detail-label">رقم الهاتف</div>
                      <div className="admin-detail-value" style={{ direction: 'ltr', textAlign: 'right' }}>
                        {data.complainant?.phone || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="admin-detail-label">البريد الإلكتروني</div>
                      <div className="admin-detail-value">{data.complainant?.email || '-'}</div>
                    </div>
                    {data.complainant?.beneficiaryExternalId && (
                      <div>
                        <div className="admin-detail-label">معرّف المستفيد</div>
                        <div className="admin-detail-value">{data.complainant.beneficiaryExternalId}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Location */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>الموقع</h3>
                <div className="admin-detail-fields">
                  <div>
                    <div className="admin-detail-label">المحافظة</div>
                    <div className="admin-detail-value">{data.governorate?.nameAr || '-'}</div>
                  </div>
                  <div>
                    <div className="admin-detail-label">المديرية</div>
                    <div className="admin-detail-value">{data.district?.nameAr || '-'}</div>
                  </div>
                  {data.village && (
                    <div>
                      <div className="admin-detail-label">القرية</div>
                      <div className="admin-detail-value">{data.village}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff-related */}
              {data.isRelatedToStaff && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px', color: 'var(--color-danger)' }}>
                    ⚠️ مرتبط بموظف
                  </h3>
                  <div className="admin-detail-fields">
                    <div>
                      <div className="admin-detail-label">اسم الموظف</div>
                      <div className="admin-detail-value">{data.relatedStaffName || '-'}</div>
                    </div>
                    <div>
                      <div className="admin-detail-label">المنصب</div>
                      <div className="admin-detail-value">{data.relatedStaffPosition || '-'}</div>
                    </div>
                  </div>
                  {data.staffIncidentDetails && (
                    <div style={{ marginTop: '12px' }}>
                      <div className="admin-detail-label">تفاصيل الحادثة</div>
                      <div className="admin-detail-description">{data.staffIncidentDetails}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments */}
              {data.attachments.length > 0 && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>المرفقات</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {data.attachments.map((att) => (
                      <li key={att.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)', fontSize: '14px' }}>
                        📎 {att.originalName}
                        <span style={{ color: 'var(--color-text-muted)', marginInlineStart: '8px', fontSize: '12px' }}>
                          ({(att.sizeBytes / 1024).toFixed(0)} KB)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status History */}
              {data.statusHistory.length > 0 && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '16px' }}>سجل الحالات</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {data.statusHistory.map((entry) => (
                      <div
                        key={entry.id}
                        style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '6px', fontSize: '14px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>
                            {entry.fromStatus
                              ? `${STATUS_LABELS[entry.fromStatus as ComplaintStatus] || entry.fromStatus} ← ${STATUS_LABELS[entry.toStatus as ComplaintStatus] || entry.toStatus}`
                              : STATUS_LABELS[entry.toStatus as ComplaintStatus] || entry.toStatus}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                            {new Date(entry.createdAt).toLocaleString('ar')}
                          </span>
                        </div>
                        {entry.note && (
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{entry.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="admin-detail-sidebar">
          {/* Assignment */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card__header">
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>التعيين الحالي</h2>
            </div>
            <div className="card__body">
              {data.assignedTo ? (
                <div className="admin-assignment-badge admin-assignment-badge--user">
                  معين للموظف: <strong>{data.assignedTo.fullName}</strong>
                </div>
              ) : data.assignedToOrgUnit ? (
                <div className="admin-assignment-badge admin-assignment-badge--unit">
                  معين للقسم: <strong>{data.assignedToOrgUnit.name}</strong>
                </div>
              ) : (
                <div style={{ marginBottom: '16px', color: 'var(--color-text-muted)' }}>غير معين</div>
              )}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
                {assignError && (
                  <div className="alert alert-danger" style={{ marginBottom: '12px', fontSize: '13px' }}>
                    {assignError}
                  </div>
                )}
                <div className="field" style={{ marginBottom: '8px' }}>
                  <label htmlFor="assignUserId">تعيين لموظف (معرف)</label>
                  <input
                    id="assignUserId"
                    type="number"
                    placeholder="معرف الموظف"
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    min="1"
                  />
                </div>
                <div className="field" style={{ marginBottom: '8px' }}>
                  <label htmlFor="assignOrgUnitId">تعيين لقسم</label>
                  <select
                    id="assignOrgUnitId"
                    value={assignOrgUnitId}
                    onChange={(e) => setAssignOrgUnitId(e.target.value)}
                  >
                    <option value="">— لا يوجد —</option>
                    {orgUnits.filter((u) => u.isActive).map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                    {groups.filter((g) => g.isActive).map((group) => (
                      <option key={`g-${group.id}`} value="">
                        {group.nameAr} (فريق)
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleAssign}
                  type="button"
                >
                  تحديث التعيين
                </button>
              </div>
            </div>
          </div>

          {/* Status Updates */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card__header">
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>تحديث الحالة</h2>
            </div>
            <div className="card__body">
              {statusError && (
                <div className="alert alert-danger" style={{ marginBottom: '12px', fontSize: '13px' }}>
                  {statusError}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {(Object.entries(STATUS_LABELS) as [ComplaintStatus, string][]).map(
                  ([key, label]) =>
                    key !== data.status && (
                      <button
                        key={key}
                        className="btn btn-outline"
                        style={{ flex: '1', minWidth: '100px', fontSize: '12px', padding: '6px' }}
                        onClick={() => setUpdatingStatus(key)}
                        type="button"
                      >
                        {label}
                      </button>
                    )
                )}
              </div>

              {updatingStatus && (
                <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                  <div style={{ marginBottom: '8px', fontWeight: 600 }}>
                    تغيير إلى: {STATUS_LABELS[updatingStatus]}
                  </div>
                  <div className="field" style={{ marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="ملاحظة..."
                      value={statusUpdateNote}
                      onChange={(e) => setStatusUpdateNote(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => handleStatusUpdate(updatingStatus)}
                      type="button"
                    >
                      تأكيد
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setUpdatingStatus(null);
                        setStatusUpdateNote('');
                        setStatusError('');
                      }}
                      type="button"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SLA & Escalation */}
          <div className="card">
            <div className="card__header">
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>مؤشرات الأداء والتصعيد</h2>
            </div>
            <div className="card__body">
              <div style={{ marginBottom: '16px' }}>
                <div className="admin-detail-label">حالة SLA</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: slaInfo.color }}>
                  {slaInfo.label}
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div className="admin-detail-label">مستوى التصعيد</div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: data.escalationLevel > 0 ? 'var(--color-danger)' : 'inherit',
                }}>
                  {data.escalationLevel}
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div className="admin-detail-label">تاريخ الاستحقاق</div>
                <div style={{ fontWeight: 500 }}>
                  {data.slaDueAt ? new Date(data.slaDueAt).toLocaleString('ar') : '-'}
                </div>
              </div>
              {data.lastEscalatedAt && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="admin-detail-label">آخر تصعيد</div>
                  <div style={{ fontWeight: 500 }}>
                    {new Date(data.lastEscalatedAt).toLocaleString('ar')}
                  </div>
                </div>
              )}

              {/* Escalation Events */}
              {data.escalationEvents.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="admin-detail-label" style={{ marginBottom: '8px' }}>أحداث التصعيد</div>
                  {data.escalationEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{ padding: '8px 10px', background: '#fef2f2', borderRadius: '4px', fontSize: '13px', marginBottom: '6px' }}
                    >
                      مستوى {evt.fromLevel} → {evt.toLevel}
                      {evt.note && <span style={{ color: 'var(--color-text-muted)' }}> — {evt.note}</span>}
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {new Date(evt.createdAt).toLocaleString('ar')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
                {escalateError && (
                  <div className="alert alert-danger" style={{ marginBottom: '12px', fontSize: '13px' }}>
                    {escalateError}
                  </div>
                )}
                <div className="field" style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="ملاحظة التصعيد اليدوي..."
                    value={escalateNote}
                    onChange={(e) => setEscalateNote(e.target.value)}
                  />
                </div>
                <button
                  className="btn"
                  style={{ width: '100%', background: 'var(--color-danger)', color: 'white', border: 'none' }}
                  onClick={handleEscalate}
                  type="button"
                >
                  تصعيد يدوي
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
