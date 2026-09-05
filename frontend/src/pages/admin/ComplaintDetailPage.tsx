import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getComplaint,
  fetchComplaintTransitions,
  updateComplaintStatus,
  updateComplaintAssignment,
  escalateComplaint,
  fetchOrganizationNodes,
  type AdminComplaintDetail,
  type ComplaintStatus,
  type ComplaintTransition,
  type OrganizationNodeDto,
  type SlaStatus,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import AuditMetadata from '../../components/admin/AuditMetadata';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/dateTime';
import { AlertTriangle, Paperclip } from 'lucide-react';

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
  none: { label: 'غير محدد', tone: 'none' },
};

export default function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission, currentOrganizationId } = useAuth();
  const organizationId = currentOrganizationId ?? user?.defaultOrganizationId ?? null;
  const canAssign = organizationId !== null && organizationId !== undefined && hasPermission('complaints.assign', organizationId);
  const canEscalate = organizationId !== null && organizationId !== undefined && hasPermission('complaints.escalate', organizationId);
  const [data, setData] = useState<AdminComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status update state
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<ComplaintStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [transitions, setTransitions] = useState<ComplaintTransition[]>([]);
  const [transitionsLoading, setTransitionsLoading] = useState(false);
  const [transitionsError, setTransitionsError] = useState('');

  // Assignment state
  const [assignUserId, setAssignUserId] = useState('');
  const [assignOrganizationNodeId, setAssignOrganizationNodeId] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Escalation state
  const [escalateNote, setEscalateNote] = useState('');
  const [escalateError, setEscalateError] = useState('');
  const [escalateSaving, setEscalateSaving] = useState(false);

  // Org data for assignment dropdowns
  const [organizationNodes, setOrganizationNodes] = useState<OrganizationNodeDto[]>([]);

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

  useEffect(() => {
    if (!id || !data || !canAssign) {
      setTransitions([]);
      setTransitionsError('');
      setTransitionsLoading(false);
      return;
    }

    setTransitionsLoading(true);
    setTransitionsError('');
    fetchComplaintTransitions(Number(id))
      .then(setTransitions)
      .catch((err) => {
        const apiErr = err as ApiClientError;
        setTransitions([]);
        setTransitionsError(apiErr.message || 'تعذر تحميل الإجراءات المتاحة حالياً.');
      })
      .finally(() => setTransitionsLoading(false));
  }, [id, data?.status, canAssign]);

  // Load canonical organization nodes for assignment; groups are not assignees.
  useEffect(() => {
    if (canAssign) fetchOrganizationNodes().then(setOrganizationNodes).catch(() => {/* Non-critical */});
  }, [canAssign]);

  const handleStatusUpdate = async (newStatus: ComplaintStatus) => {
    setStatusError('');
    setStatusSaving(true);
    try {
      const updated = await updateComplaintStatus(Number(id), newStatus, statusUpdateNote || undefined);
      setData(updated);
      setStatusUpdateNote('');
      setUpdatingStatus(null);
    } catch (err) {
      const apiErr = err as ApiClientError;
      setStatusError(apiErr.status === 409
        ? 'لا يمكن تنفيذ هذا الانتقال من الحالة الحالية. راجع الحالة الحالية واختر إجراءً متاحاً.'
        : apiErr.message || 'حدث خطأ أثناء تحديث الحالة');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleAssign = async () => {
    setAssignError('');
    const parsedUserId = assignUserId.trim() ? Number(assignUserId) : null;
    const parsedOrganizationNodeId = assignOrganizationNodeId ? Number(assignOrganizationNodeId) : null;
    if (parsedUserId !== null && (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0)) {
      setAssignError('معرّف الموظف يجب أن يكون رقماً صحيحاً موجباً.');
      return;
    }
    setAssignSaving(true);
    try {
      const updated = await updateComplaintAssignment(
        Number(id),
        parsedUserId,
        parsedOrganizationNodeId
      );
      setData(updated);
      setAssignUserId('');
      setAssignOrganizationNodeId('');
    } catch (err) {
      const apiErr = err as ApiClientError;
      setAssignError(apiErr.message || 'حدث خطأ أثناء التعيين');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleEscalate = async () => {
    setEscalateError('');
    setEscalateSaving(true);
    try {
      const updated = await escalateComplaint(Number(id), escalateNote || undefined);
      setData(updated);
      setEscalateNote('');
    } catch (err) {
      const apiErr = err as ApiClientError;
      setEscalateError(apiErr.message || 'حدث خطأ أثناء التصعيد');
    } finally {
      setEscalateSaving(false);
    }
  };

  if (loading && !data) {
    return <div className="cd-loading">جاري التحميل...</div>;
  }

  if (error || !data) {
    return (
      <div className="alert alert-danger">
        {error || 'لم يتم العثور على تفاصيل الطلب'}
        <br />
        <Link to="/admin/complaints" className="cd-error-link">
          العودة للصندوق
        </Link>
      </div>
    );
  }

  const slaInfo = SLA_STATUS_LABELS[data.slaStatus] || SLA_STATUS_LABELS.none;

  return (
    <div>
      {/* Header */}
      <div className="cd-page-head">
        <h1 className="admin-page-title">طلب {data.referenceCode}</h1>
        <Link to="/admin/complaints" className="btn btn-outline">عودة</Link>
      </div>

      <div className="admin-detail-grid">
        {/* Main Content */}
        <div className="admin-detail-main">
          {/* Basic Info */}
          <div className="card cd-card">
            <div className="card__header cd-card-head">
              <h2 className="cd-card-heading">التفاصيل الأساسية</h2>
              <span
                className={"admin-status-badge cd-status cs-" + data.status}
              >
                {STATUS_LABELS[data.status] || data.status}
              </span>
            </div>
            <div className="card__body">
              {data.isSensitive && (
                <div className="alert alert-danger cd-sensitive">
                  <AlertTriangle size={16} aria-hidden="true" />
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
                  <div className="admin-detail-label">تاريخ الإنشاء</div>
                  <div className="admin-detail-value">{formatDateTime(data.createdAt)}</div>
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
              <div className="cd-block">
                <div className="admin-detail-label">الوصف</div>
                <div className="admin-detail-description">{data.description}</div>
              </div>
              {data.desiredResolution && (
                <div className="cd-block">
                  <div className="admin-detail-label">الحل المطلوب</div>
                  <div className="admin-detail-description">{data.desiredResolution}</div>
                </div>
              )}

              {/* Complainant */}
              <div className="cd-section">
                <h3 className="cd-section-title">بيانات المتقدم</h3>
                {data.isAnonymous ? (
                  <div className="admin-muted">تقديم مجهول</div>
                ) : (
                  <div className="admin-detail-fields">
                    <div>
                      <div className="admin-detail-label">الاسم</div>
                      <div className="admin-detail-value">{data.complainant?.fullName || '-'}</div>
                    </div>
                    <div>
                      <div className="admin-detail-label">رقم الهاتف</div>
                      <div className="admin-detail-value cd-phone">
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
              <div className="cd-section">
                <h3 className="cd-section-title">الموقع</h3>
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
                <div className="cd-section">
                  <h3 className="cd-section-title cd-section-title--danger">
                    مرتبط بموظف
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
                    <div className="cd-block">
                      <div className="admin-detail-label">تفاصيل الحادثة</div>
                      <div className="admin-detail-description">{data.staffIncidentDetails}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments */}
              {data.attachments.length > 0 && (
                <div className="cd-section">
                  <h3 className="cd-section-title">المرفقات</h3>
                  <ul className="cd-attachment-list">
                    {data.attachments.map((att) => (
                      <li key={att.id} className="cd-attachment">
                        <Paperclip size={14} aria-hidden="true" className="cd-attachment-icon" /> {att.originalName}
                        <span className="cd-file-size">
                          ({(att.sizeBytes / 1024).toFixed(0)} KB)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status History */}
              {data.statusHistory.length > 0 && (
                <div className="cd-section">
                  <h3 className="cd-section-title">سجل الحالات</h3>
                  <div className="cd-timeline">
                    {data.statusHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="cd-timeline-item"
                      >
                        <div className="cd-timeline-head">
                          <span>
                            {entry.fromStatus
                              ? `${STATUS_LABELS[entry.fromStatus as ComplaintStatus] || entry.fromStatus} ← ${STATUS_LABELS[entry.toStatus as ComplaintStatus] || entry.toStatus}`
                              : STATUS_LABELS[entry.toStatus as ComplaintStatus] || entry.toStatus}
                          </span>
                          <span className="cd-timeline-time">
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                        {entry.note && (
                          <div className="cd-timeline-note">{entry.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Record Information — audit metadata (secondary to business data) */}
              <div className="cd-section">
                <h3 className="cd-section-title">معلومات السجل</h3>
                <AuditMetadata createdAt={data.createdAt} updatedAt={data.updatedAt} />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="admin-detail-sidebar">
          {/* Assignment */}
          <div className="card cd-card">
            <div className="card__header">
              <h2 className="cd-card-heading">التعيين الحالي</h2>
            </div>
            <div className="card__body">
              {data.assignedTo ? (
                <div className="admin-assignment-badge admin-assignment-badge--user">
                  معين للموظف: <strong>{data.assignedTo.fullName}</strong>
                </div>
              ) : data.assignedToOrganization ? (
                <div className="admin-assignment-badge admin-assignment-badge--unit">
                  معين للعقدة التنظيمية: <strong>{data.assignedToOrganization.name}</strong>
                </div>
              ) : (
                <div className="cd-assign-hint">غير معين</div>
              )}

              {canAssign ? (
                <div className="cd-section">
                  {assignError && <div className="alert alert-danger cd-alert-sm" role="alert" aria-live="polite">{assignError}</div>}
                  <div className="field cd-label-spaced">
                    <label htmlFor="assignUserId">تعيين لموظف (المعرّف)</label>
                    <input id="assignUserId" type="number" placeholder="معرّف الموظف" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} min="1" inputMode="numeric" />
                  </div>
                  <div className="field cd-label-spaced">
                    <label htmlFor="assignOrganizationNodeId">تعيين لعقدة تنظيمية</label>
                    <select id="assignOrganizationNodeId" value={assignOrganizationNodeId} onChange={(e) => setAssignOrganizationNodeId(e.target.value)}>
                      <option value="">— لا يوجد —</option>
                      {organizationNodes.filter((node) => node.isActive).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary cd-full-btn" onClick={handleAssign} disabled={assignSaving} type="button">{assignSaving ? 'جارٍ تحديث التعيين…' : 'تحديث التعيين'}</button>
                </div>
              ) : (
                <div className="admin-readonly-note" role="status">لا تملك صلاحية تعديل التعيين.</div>
              )}
            </div>
          </div>

          {/* Status Updates */}
          <div className="card cd-card">
            <div className="card__header">
              <h2 className="cd-card-heading">تحديث الحالة</h2>
            </div>
            <div className="card__body">
              {canAssign ? <>
                {statusError && <div className="alert alert-danger cd-alert-sm" role="alert" aria-live="polite">{statusError}</div>}
                {transitionsLoading && <div className="admin-readonly-note" role="status" aria-live="polite">جارٍ تحميل الإجراءات المتاحة…</div>}
                {!transitionsLoading && transitionsError && <div className="alert alert-danger" role="alert" aria-live="polite">تعذر التحقق من الانتقالات المتاحة، لذلك لن تُعرض إجراءات الحالة حالياً. {transitionsError}</div>}
                {!transitionsLoading && !transitionsError && transitions.length === 0 && <div className="admin-readonly-note" role="status">لا توجد انتقالات متاحة من الحالة الحالية.</div>}
                {!transitionsLoading && !transitionsError && transitions.length > 0 && (
                  <div className="cd-status-actions">
                    {transitions.map((transition) => <button key={transition.id} className="btn btn-outline cd-status-btn" onClick={() => setUpdatingStatus(transition.toStatus)} disabled={statusSaving} type="button">{transition.nameAr || STATUS_LABELS[transition.toStatus] || transition.toStatus}</button>)}
                  </div>
                )}
              </> : <div className="admin-readonly-note" role="status">لا تملك صلاحية تغيير حالة الطلب.</div>}

              {canAssign && updatingStatus && (
                <div className="cd-assign-panel">
                  <div className="cd-panel-title">
                    تغيير إلى: {STATUS_LABELS[updatingStatus]}
                  </div>
                  <div className="field cd-label-spaced">
                    <label htmlFor="statusUpdateNote">ملاحظة التغيير (اختيارية)</label>
                    <input id="statusUpdateNote" type="text" placeholder="أضف ملاحظة اختيارية…" value={statusUpdateNote} onChange={(e) => setStatusUpdateNote(e.target.value)} />
                  </div>
                  <div className="cd-inline">
                    <button
                      className="btn btn-primary cd-flex-1"
                      onClick={() => handleStatusUpdate(updatingStatus)}
                      disabled={statusSaving}
                      type="button"
                    >
                      {statusSaving ? 'جارٍ الحفظ…' : 'تأكيد'}
                    </button>
                    <button
                      className="btn btn-outline cd-flex-1"
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
              <h2 className="cd-card-heading">مؤشرات الأداء والتصعيد</h2>
            </div>
            <div className="card__body">
              <div className="cd-spaced">
                <div className="admin-detail-label">حالة SLA</div>
                <div className={"cd-kpi cs-" + slaInfo.tone}>
                  {slaInfo.label}
                </div>
              </div>
              <div className="cd-spaced">
                <div className="admin-detail-label">مستوى التصعيد</div>`n      <div className={"cd-kpi cd-kpi--lg" + (data.escalationLevel > 0 ? " cs-danger" : "")}>
                  {data.escalationLevel}
                </div>
              </div>
              <div className="cd-spaced">
                <div className="admin-detail-label">تاريخ الاستحقاق</div>
                <div className="cd-strong">
                  {formatDateTime(data.slaDueAt)}
                </div>
              </div>
              {data.lastEscalatedAt && (
                <div className="cd-spaced">
                  <div className="admin-detail-label">آخر تصعيد</div>
                  <div className="cd-strong">
                    {formatDateTime(data.lastEscalatedAt)}
                  </div>
                </div>
              )}

              {/* Escalation Events */}
              {data.escalationEvents.length > 0 && (
                <div className="cd-spaced">
                  <div className="admin-detail-label cd-label-spaced">أحداث التصعيد</div>
                  {data.escalationEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="cd-escalation-event"
                    >
                      مستوى {evt.fromLevel} → {evt.toLevel}
                      {evt.note && <span className="admin-muted"> — {evt.note}</span>}
                      <div className="cd-ev-time">
                        {formatDateTime(evt.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canEscalate ? <div className="cd-section">
                {escalateError && <div className="alert alert-danger cd-alert-sm" role="alert" aria-live="polite">{escalateError}</div>}
                <div className="field cd-label-spaced"><label htmlFor="escalateNote">ملاحظة التصعيد اليدوي</label><input id="escalateNote" type="text" placeholder="أضف ملاحظة اختيارية…" value={escalateNote} onChange={(e) => setEscalateNote(e.target.value)} /></div>
                <button className="btn btn cd-escalate-btn" onClick={handleEscalate} disabled={escalateSaving} type="button">{escalateSaving ? 'جارٍ التصعيد…' : 'تصعيد يدوي'}</button>
              </div> : <div className="admin-readonly-note" role="status">لا تملك صلاحية التصعيد اليدوي.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
