import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ApiClientError } from '../../api/axiosClient';
import {
  activatePlatformUser,
  deactivatePlatformUser,
  fetchPlatformUser,
  type PlatformUserDetails,
} from '../../api/platformApi';
import { ConfirmDialog, DataState } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/dateTime';

const parseUserId = (value: string | undefined): number | null => {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export default function PlatformUserDetailPage() {
  const { userId: userIdParam } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const userId = parseUserId(userIdParam);
  const [user, setUser] = useState<PlatformUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [action, setAction] = useState<'activate' | 'deactivate' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loadUser = useCallback(() => {
    if (userId === null) {
      setError('معرّف المستخدم غير صالح.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetchPlatformUser(userId)
      .then(setUser)
      .catch((err: ApiClientError) => setError(err.message || 'تعذر تحميل بيانات المستخدم.'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const confirmStatusChange = async () => {
    if (!user || !action) return;
    setBusy(true);
    setActionError('');
    try {
      const updated = action === 'activate'
        ? await activatePlatformUser(user.id)
        : await deactivatePlatformUser(user.id);
      setUser((current) => current ? { ...current, ...updated } : updated as PlatformUserDetails);
      setNotice(action === 'activate' ? 'تم تفعيل الحساب بنجاح.' : 'تم إلغاء تفعيل الحساب بنجاح.');
      setAction(null);
    } catch (err) {
      setActionError((err as ApiClientError).message || 'تعذر تحديث حالة الحساب.');
    } finally {
      setBusy(false);
    }
  };

  const backAction = <Link className="btn btn-outline" to="/admin/platform/users">العودة إلى المستخدمين</Link>;

  if (loading) {
    return <><PageHeader title="تفاصيل مستخدم المنصة" actions={backAction} /><DataState loading error="" empty={false} onRetry={loadUser}>{null}</DataState></>;
  }

  if (error || !user) {
    return <><PageHeader title="تفاصيل مستخدم المنصة" actions={backAction} /><DataState loading={false} error={error || 'المستخدم غير موجود.'} empty={false} onRetry={loadUser}>{null}</DataState></>;
  }

  return (
    <div>
      <PageHeader title={user.fullName} description="إدارة حساب المستخدم على مستوى المنصة فقط." actions={backAction} />
      {notice && <div className="admin-success" role="status" style={{ marginBottom: '16px' }}>{notice}</div>}
      {actionError && <div className="admin-state admin-state--error" role="alert" style={{ marginBottom: '16px' }}>{actionError}</div>}

      <div className="card">
        <div className="card__body">
          <div className="admin-detail-header">
            <div>
              <p className="admin-page-description">حالة الحساب</p>
              <StatusBadge tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'نشط' : 'معطّل'}</StatusBadge>
            </div>
            <button
              className={user.isActive ? 'btn admin-btn-danger' : 'btn btn-primary'}
              type="button"
              onClick={() => setAction(user.isActive ? 'deactivate' : 'activate')}
            >
              {user.isActive ? 'إلغاء تفعيل الحساب' : 'تفعيل الحساب'}
            </button>
          </div>

          <dl className="admin-detail-grid">
            <div><dt>المعرّف</dt><dd>{user.id}</dd></div>
            <div><dt>البريد الإلكتروني</dt><dd dir="ltr">{user.email}</dd></div>
            <div><dt>تاريخ الإنشاء</dt><dd>{formatDateTime(user.createDate)}</dd></div>
            <div><dt>آخر تحديث</dt><dd>{formatDateTime(user.writeDate)}</dd></div>
            <div><dt>المؤسسة الافتراضية</dt><dd>{user.defaultOrganizationId ?? '—'}</dd></div>
            <div><dt>العقدة التنظيمية الأساسية</dt><dd>{user.primaryOrganizationNodeId ?? '—'}</dd></div>
            <div><dt>عدد العضويات</dt><dd>{user.memberships.length}</dd></div>
            <div><dt>أدوار المنصة</dt><dd>{user.platformRoles.length || 'لا توجد'}</dd></div>
          </dl>
        </div>
      </div>

      {action && (
        <ConfirmDialog
          title={action === 'activate' ? 'تفعيل حساب المستخدم' : 'إلغاء تفعيل حساب المستخدم'}
          message={action === 'activate'
            ? `هل تريد تفعيل حساب «${user.fullName}»؟`
            : `هل تريد إلغاء تفعيل حساب «${user.fullName}»؟ لن يتمكن المستخدم من تسجيل الدخول حتى إعادة تفعيله.`}
          onClose={() => setAction(null)}
          onConfirm={confirmStatusChange}
          busy={busy}
        />
      )}
    </div>
  );
}
