import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ApiClientError } from '../../api/axiosClient';
import {
  archivePlatformTenant,
  deactivatePlatformTenant,
  fetchPlatformTenant,
  reactivatePlatformTenant,
  suspendPlatformTenant,
  type PlatformTenantDetails,
  type PlatformTenantLifecycleStatus,
} from '../../api/platformApi';
import { DataState, FormDialog } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import { Textarea } from '../../components/ui/FormField';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/dateTime';

const parseOrganizationId = (value: string | undefined): number | null => {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const statusMeta: Record<PlatformTenantLifecycleStatus, { label: string; tone: StatusTone }> = {
  provisioning: { label: 'قيد التهيئة', tone: 'info' },
  active: { label: 'نشط', tone: 'success' },
  suspended: { label: 'موقوف', tone: 'warning' },
  deactivated: { label: 'معطّل', tone: 'danger' },
  archived: { label: 'مؤرشف', tone: 'neutral' },
};

type LifecycleAction = 'suspend' | 'reactivate' | 'deactivate' | 'archive';

const ACTION_META: Record<LifecycleAction, { title: string; message: string; submitLabel: string }> = {
  suspend: {
    title: 'إيقاف المستأجر',
    message: 'سيتم منع الوصول التشغيلي إلى هذا المستأجر مع الإبقاء على العضويات والأدوار دون تغيير.',
    submitLabel: 'تأكيد الإيقاف',
  },
  reactivate: {
    title: 'إعادة تفعيل المستأجر',
    message: 'سيتم إعادة السماح بالوصول وفق العضويات والأدوار الحالية.',
    submitLabel: 'تأكيد إعادة التفعيل',
  },
  deactivate: {
    title: 'تعطيل المستأجر',
    message: 'سيتم تعطيل المستأجر. لا يمكن أرشفته إلا بعد هذه الخطوة.',
    submitLabel: 'تأكيد التعطيل',
  },
  archive: {
    title: 'أرشفة المستأجر',
    message: 'ستصبح الأرشفة نهائية ضمن دورة الحياة، ولن يكون المستأجر متاحاً للعمليات العادية.',
    submitLabel: 'تأكيد الأرشفة',
  },
};

const ACTIONS_BY_STATUS: Record<PlatformTenantLifecycleStatus, LifecycleAction[]> = {
  provisioning: [],
  active: ['suspend', 'deactivate'],
  suspended: ['reactivate'],
  deactivated: ['archive'],
  archived: [],
};

const actionLabel: Record<LifecycleAction, string> = {
  suspend: 'إيقاف المستأجر',
  reactivate: 'إعادة تفعيل المستأجر',
  deactivate: 'تعطيل المستأجر',
  archive: 'أرشفة المستأجر',
};

const actionClassName: Record<LifecycleAction, string> = {
  suspend: 'btn btn-outline',
  reactivate: 'btn btn-primary',
  deactivate: 'btn admin-btn-danger',
  archive: 'btn admin-btn-danger',
};

const lifecycleActionError = (error: unknown): string => {
  const apiError = error as ApiClientError;
  if (apiError.status === 403) return 'لا تملك صلاحية إدارة دورة حياة هذا المستأجر.';
  if (apiError.status === 404) return 'المستأجر غير موجود أو لم يعد متاحاً.';
  if (apiError.status === 409) return 'هذا الانتقال غير مسموح من الحالة الحالية للمستأجر.';
  if (apiError.status === 422) return 'بيانات الانتقال غير صالحة. تحقق من السبب المدخل.';
  return apiError.message || 'تعذر تحديث دورة حياة المستأجر.';
};

export default function PlatformTenantDetailPage() {
  const { organizationId: organizationIdParam } = useParams<{ organizationId: string }>();
  const organizationId = parseOrganizationId(organizationIdParam);
  const [tenant, setTenant] = useState<PlatformTenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loadTenant = useCallback(() => {
    if (organizationId === null) {
      setError('معرّف المؤسسة غير صالح.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    fetchPlatformTenant(organizationId)
      .then(setTenant)
      .catch((err: ApiClientError) => setError(err.message || 'تعذر تحميل بيانات المستأجر.'))
      .finally(() => setLoading(false));
  }, [organizationId]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  const openAction = (nextAction: LifecycleAction) => {
    if (!tenant || !ACTIONS_BY_STATUS[tenant.lifecycleStatus].includes(nextAction)) return;
    setAction(nextAction);
    setReason('');
    setActionError('');
    setNotice('');
  };

  const confirmTransition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tenant || !action) return;

    setActionBusy(true);
    setActionError('');
    setNotice('');
    try {
      if (action === 'suspend') await suspendPlatformTenant(tenant.id, reason);
      if (action === 'reactivate') await reactivatePlatformTenant(tenant.id, reason);
      if (action === 'deactivate') await deactivatePlatformTenant(tenant.id, reason);
      if (action === 'archive') await archivePlatformTenant(tenant.id, reason);
      setAction(null);
      setReason('');
      setNotice('تم تحديث دورة حياة المستأجر بنجاح.');
      await loadTenant();
    } catch (transitionError) {
      setActionError(lifecycleActionError(transitionError));
    } finally {
      setActionBusy(false);
    }
  };

  const backAction = <Link className="btn btn-outline" to="/admin/platform/tenants">العودة إلى الدليل</Link>;

  if (loading) {
    return (
      <>
        <PageHeader title="تفاصيل المستأجر" actions={backAction} />
        <DataState loading error="" empty={false} onRetry={loadTenant}>{null}</DataState>
      </>
    );
  }

  if (error || !tenant) {
    return (
      <>
        <PageHeader title="تفاصيل المستأجر" actions={backAction} />
        <DataState loading={false} error={error || 'المستأجر غير موجود.'} empty={false} onRetry={loadTenant}>{null}</DataState>
      </>
    );
  }

  const status = statusMeta[tenant.lifecycleStatus];

  return (
    <div>
      <PageHeader
        title={tenant.legalName}
        description="بيانات الدليل ودورة الحياة على مستوى المنصة فقط."
        actions={backAction}
      />

      {notice && <div className="admin-success" role="status" style={{ marginBottom: '16px' }}>{notice}</div>}

      <section className="card">
        <div className="card__body">
          <div className="admin-detail-header">
            <div>
              <p className="admin-page-description">حالة دورة الحياة</p>
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </div>
            <div className="admin-page-actions">
              {ACTIONS_BY_STATUS[tenant.lifecycleStatus].map((nextAction) => (
                <button
                  key={nextAction}
                  className={actionClassName[nextAction]}
                  type="button"
                  onClick={() => openAction(nextAction)}
                  disabled={actionBusy}
                >
                  {actionLabel[nextAction]}
                </button>
              ))}
            </div>
          </div>

          <dl className="admin-detail-grid">
            <div><dt>المعرّف</dt><dd>{tenant.id}</dd></div>
            <div><dt>الاسم المختصر</dt><dd>{tenant.shortName || '—'}</dd></div>
            <div><dt>المعرّف (slug)</dt><dd dir="ltr">{tenant.slug}</dd></div>
            <div><dt>الوصف</dt><dd>{tenant.description || '—'}</dd></div>
            <div><dt>البريد الإلكتروني</dt><dd dir="ltr">{tenant.email || '—'}</dd></div>
            <div><dt>الموقع الإلكتروني</dt><dd dir="ltr">{tenant.website || '—'}</dd></div>
            <div><dt>الحالة الفعلية</dt><dd>{tenant.isActive ? 'مفعّلة' : 'غير مفعّلة'}</dd></div>
            <div><dt>الدولة</dt><dd>{tenant.countryId ?? '—'}</dd></div>
            <div><dt>المحافظة</dt><dd>{tenant.governorateId ?? '—'}</dd></div>
            <div><dt>المديرية</dt><dd>{tenant.districtId ?? '—'}</dd></div>
            <div><dt>تاريخ الإنشاء</dt><dd>{formatDateTime(tenant.createdAt)}</dd></div>
            <div><dt>آخر تحديث</dt><dd>{formatDateTime(tenant.writeDate)}</dd></div>
            <div><dt>آخر تغيير للحالة</dt><dd>{formatDateTime(tenant.statusChangedAt)}</dd></div>
            <div><dt>منفّذ تغيير الحالة</dt><dd>{tenant.statusChangedByUserId ?? '—'}</dd></div>
            <div><dt>سبب تغيير الحالة</dt><dd>{tenant.statusReason || '—'}</dd></div>
            <div><dt>تاريخ الأرشفة/الحذف</dt><dd>{formatDateTime(tenant.deletedAt)}</dd></div>
            <div><dt>العقدة الأصل</dt><dd>{tenant.parentId ?? '—'}</dd></div>
            <div><dt>جذر المستأجر</dt><dd>{tenant.rootOrganizationId ?? '—'}</dd></div>
            <div><dt>نوع الوحدة التنظيمية</dt><dd>{tenant.orgUnitTypeId ?? '—'}</dd></div>
          </dl>
        </div>
      </section>

      {action && (
        <FormDialog
          title={ACTION_META[action].title}
          onClose={() => {
            if (!actionBusy) setAction(null);
          }}
          onSubmit={confirmTransition}
          saving={actionBusy}
          error={actionError}
          submitLabel={ACTION_META[action].submitLabel}
        >
          <p className="admin-page-description">{ACTION_META[action].message}</p>
          <Textarea
            label="سبب التغيير (اختياري)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={255}
            disabled={actionBusy}
            hint="يمكن تسجيل سبب مختصر لهذا الانتقال."
          />
        </FormDialog>
      )}
    </div>
  );
}
