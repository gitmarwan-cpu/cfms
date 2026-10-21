import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader, DataState } from '../../components/admin/AdminUi';
import {
  fetchEmailSettings,
  updateEmailSettings,
  sendTestEmail,
  type EmailSettings,
  type UpdateEmailSettingsPayload,
} from '../../api/platformSettingsApi';
import type { ApiClientError } from '../../api/axiosClient';
import { Mail, ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Send } from 'lucide-react';

export default function PlatformEmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form fields
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [password, setPassword] = useState('');

  // Form states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Test states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchEmailSettings();
      setSettings(data);
      setHost(data.host || '');
      setPort(data.port || 587);
      setSecure(data.secure);
      setUsername(data.username || '');
      setSenderEmail(data.senderEmail || '');
      setSenderName(data.senderName || '');
      setPassword(''); // Never populate password
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message || 'فشل تحميل إعدادات البريد الإلكتروني');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaving(true);

    const payload: UpdateEmailSettingsPayload = {
      host: host.trim(),
      port: Number(port),
      secure,
      username: username.trim(),
      senderEmail: senderEmail.trim(),
      senderName: senderName.trim(),
      password: password ? password.trim() : undefined,
    };

    try {
      const updated = await updateEmailSettings(payload);
      setSettings(updated);
      setPassword('');
      setSaveSuccess('تم حفظ إعدادات البريد الإلكتروني بنجاح وتحديث خادم الإرسال.');
    } catch (err) {
      const apiErr = err as ApiClientError;
      setSaveError(apiErr.message || 'فشل حفظ الإعدادات، يرجى التحقق من الحقول والمحاولة مجدداً.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await sendTestEmail();
      setTestResult({ success: true, message: res.message || 'تم إرسال البريد التجريبي بنجاح.' });
    } catch (err) {
      const apiErr = err as ApiClientError;
      setTestResult({
        success: false,
        message: apiErr.message || 'فشل إرسال البريد التجريبي. تحقق من الإعدادات وصحة الاعتماد.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="إعدادات البريد الإلكتروني والإشعارات"
        description="تهيئة خادم SMTP لإرسال رسائل استرداد كلمة المرور والإشعارات على مستوى المنصة."
        actions={
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadSettings}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} />
            تحديث الحالة
          </button>
        }
      />

      <DataState loading={loading} error={error} empty={false} onRetry={loadSettings}>
        {settings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Operational Status Card */}
            <div className="card">
              <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} color="var(--color-primary)" />
                  الحالة التشغيلية ومصدر الإعدادات
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {settings.source === 'database' ? (
                    <span className="badge" style={{ background: '#e6f4ea', color: '#137333', fontWeight: 600 }}>
                      قاعدة البيانات (المصدر المعتمد)
                    </span>
                  ) : settings.source === 'environment' ? (
                    <span className="badge" style={{ background: '#fef7e0', color: '#b06000', fontWeight: 600 }}>
                      المتغيرات البيئية (.env احتياطي)
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#f1f3f4', color: '#5f6368', fontWeight: 600 }}>
                      غير مهيأ
                    </span>
                  )}

                  {settings.status === 'active' ? (
                    <span className="badge" style={{ background: '#e6f4ea', color: '#137333' }}>نشط ومفعّل</span>
                  ) : settings.status === 'error' ? (
                    <span className="badge" style={{ background: '#fce8e6', color: '#c5221f' }}>
                      خطأ تشغيلي {settings.errorDetail ? `(${settings.errorDetail})` : ''}
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#f1f3f4', color: '#5f6368' }}>بانتظار الإعداد</span>
                  )}
                </div>
              </div>
              <div className="card__body">
                {settings.errorDetail === 'decryption_failed' && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                    <strong>تنبيه أمني:</strong> فشل فك تشفير كلمة المرور المحفوظة في قاعدة البيانات (اختلاف مفتاح التشفير أو تلف السر). لا يتم التراجع عن هذا الخطأ بالعودة إلى المتغيرات البيئية؛ يرجى إعادة إدخال كلمة المرور وحفظها.
                  </div>
                )}
                {settings.errorDetail === 'migration_missing' && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                    <strong>تنبيه:</strong> جدول إعدادات المنصة غير موجود في قاعدة البيانات الإنتاجية. يرجى تطبيق هجرة قاعدة البيانات.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>حالة الاعتماد:</span>{' '}
                    <strong>{settings.hasPassword ? 'تم التعيين (مشفرة بـ AES-256-GCM)' : 'غير معينة'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>الخادم الحالي:</span>{' '}
                    <code>{settings.host ? `${settings.host}:${settings.port}` : 'غير محدد'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>بريد المرسل:</span>{' '}
                    <span>{settings.senderEmail || 'غير محدد'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>آخر تحديث:</span>{' '}
                    <span>{settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('ar-YE') : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Form Card */}
            <div className="card">
              <div className="card__header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={20} color="var(--color-primary)" />
                  تعديل إعدادات خادم SMTP
                </h3>
              </div>
              <div className="card__body">
                {saveSuccess && (
                  <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={18} />
                    {saveSuccess}
                  </div>
                )}
                {saveError && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} />
                    {saveError}
                  </div>
                )}

                <form onSubmit={handleSave}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="host">عنوان خادم SMTP (Host) *</label>
                      <input
                        id="host"
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="مثال: smtp.gmail.com"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="port">المنفذ (Port) *</label>
                      <input
                        id="port"
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        placeholder="587 أو 465"
                        required
                        disabled={saving}
                      />
                      <small style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        المنفذ الافتراضي الموصى به لـ Gmail هو 587 مع بروتوكول STARTTLS.
                      </small>
                    </div>

                    <div className="field">
                      <label htmlFor="username">اسم المستخدم للبريد (Username) *</label>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="marwankhalid2012@gmail.com"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="password">كلمة المرور / App Password</label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={settings.hasPassword ? '•••••••••••••••• (محفوظة مشفرة)' : 'أدخل كلمة مرور التطبيق'}
                        disabled={saving}
                        autoComplete="new-password"
                      />
                      <small style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {settings.hasPassword
                          ? 'اترك هذا الحقل فارغاً للحفاظ على كلمة المرور الحالية المحفوظة مشفرة.'
                          : 'مطلوبة: استخدم كلمة مرور التطبيق (Google App Password) المخصصة للنظام.'}
                      </small>
                    </div>

                    <div className="field">
                      <label htmlFor="senderEmail">عنوان البريد المرسل (From Address) *</label>
                      <input
                        id="senderEmail"
                        type="email"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        placeholder="marwankhalid2012@gmail.com"
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="senderName">الاسم الظاهر للمرسل (Display Name)</label>
                      <input
                        id="senderName"
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="نظام إدارة الشكاوى والمقترحات (CFMS)"
                        disabled={saving}
                      />
                    </div>

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={secure}
                          onChange={(e) => setSecure(e.target.checked)}
                          disabled={saving}
                        />
                        <span>استخدام اتصال مشفر مباشر (SSL/TLS - للمنفذ 465). اتركه غير محدد لمنفذ 587 (STARTTLS).</span>
                      </label>
                    </div>
                  </div>

                  <div className="submit-row" style={{ marginTop: '20px' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'جارٍ حفظ الإعدادات وتشفيرها...' : 'حفظ إعدادات البريد'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Test Connection Card */}
            <div className="card">
              <div className="card__header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={18} color="var(--color-primary)" />
                  اختبار الاتصال والإرسال
                </h3>
              </div>
              <div className="card__body">
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
                  يمكنك إجراء اختبار فوري لإعدادات SMTP. لحماية النظام من استغلال خادم البريد، يتم إرسال الرسالة التجريبية <strong>حصراً إلى بريدك الإلكتروني المسجل كمدير منصة</strong> وبمحتوى ثابت موثوق.
                </p>

                {testResult && (
                  <div
                    className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'}`}
                    style={{ marginBottom: '16px' }}
                  >
                    {testResult.message}
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleSendTest}
                  disabled={testing || saving || !settings.hasPassword}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={16} />
                  {testing ? 'جارٍ الاتصال وإرسال البريد التجريبي...' : 'إرسال بريد تجريبي الآن'}
                </button>
              </div>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
