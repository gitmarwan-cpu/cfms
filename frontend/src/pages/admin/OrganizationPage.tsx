import { useEffect, useState, type FormEvent } from 'react';
import { fetchOrganization, updateOrganization, type OrganizationSettings } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { DataState } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import LocationSelect from '../../components/LocationSelect';
import { useAuth } from '../../context/AuthContext';
import { CheckboxRow } from '../../components/ui/Checkbox';

export default function OrganizationPage() {
  const { hasPermission, currentOrganizationId } = useAuth();
  const canManage = currentOrganizationId !== null && currentOrganizationId !== undefined
    && hasPermission('organization.manage', currentOrganizationId);
  const [data, setData] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetchOrganization()
      .then(setData)
      .catch((e: ApiClientError) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const change = (key: keyof OrganizationSettings, value: unknown) =>
    setData((v) => (v ? { ...v, [key]: value } : v));

  const changeSettings = (key: string, value: unknown) =>
    setData((v) => {
      if (!v) return v;
      const currentSettings = (v.notificationSettings as Record<string, any>) || {};
      return {
        ...v,
        notificationSettings: {
          ...currentSettings,
          [key]: value,
        },
      };
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setNotice('');
    try {
      setData(await updateOrganization(data));
      setNotice('تم حفظ إعدادات المؤسسة.');
    } catch (err) {
      setError((err as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="المؤسسة" description="إعدادات المؤسسة الحالية ضمن سياق العضوية الفعال." />
      <DataState loading={loading} error={error} empty={!data} onRetry={load}>
        {data && (
          <form className="card admin-settings-form" onSubmit={submit}>
            {notice && (
              <div className="admin-success" role="status">
                {notice}
              </div>
            )}
            <fieldset disabled={!canManage} className="admin-fieldset-reset">
            <div className="admin-form-grid">
              <label className="field">
                الاسم القانوني
                <input
                  value={data.legalName}
                  onChange={(e) => change('legalName', e.target.value)}
                  required
                />
              </label>
              <label className="field">
                معرّف البوابة (slug)
                <input
                  dir="ltr"
                  value={data.slug || ''}
                  onChange={(e) => change('slug', e.target.value)}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  required
                />
              </label>
              <label className="field">
                الاسم المختصر
                <input
                  value={data.shortName || ''}
                  onChange={(e) => change('shortName', e.target.value || null)}
                />
              </label>
              <label className="field">
                البريد الإلكتروني
                <input
                  type="email"
                  dir="ltr"
                  value={data.email || ''}
                  onChange={(e) => change('email', e.target.value || null)}
                />
              </label>
              <label className="field">
                الهاتف
                <input
                  dir="ltr"
                  value={data.phone || ''}
                  onChange={(e) => change('phone', e.target.value || null)}
                />
              </label>
              <label className="field">
                الموقع الإلكتروني
                <input
                  type="url"
                  dir="ltr"
                  value={data.website || ''}
                  onChange={(e) => change('website', e.target.value || null)}
                />
              </label>

              {/* Cascading Location Selection: Country -> Governorate -> District */}
              <LocationSelect
                showCountry={true}
                isRequired={false}
                countryId={data.countryId || ''}
                governorateId={data.governorateId || ''}
                districtId={data.districtId || ''}
                onCountryChange={(val) => {
                  const numVal = val ? parseInt(val, 10) : null;
                  change('countryId', numVal);
                  change('governorateId', null);
                  change('districtId', null);
                }}
                onGovernorateChange={(val) => {
                  const numVal = val ? parseInt(val, 10) : null;
                  change('governorateId', numVal);
                  change('districtId', null);
                }}
                onDistrictChange={(val) => {
                  const numVal = val ? parseInt(val, 10) : null;
                  change('districtId', numVal);
                }}
              />

              <label className="field">
                المدينة
                <input
                  value={data.city || ''}
                  onChange={(e) => change('city', e.target.value || null)}
                />
              </label>
              <label className="field admin-field--full">
                العنوان
                <textarea
                  value={data.address || ''}
                  onChange={(e) => change('address', e.target.value || null)}
                />
              </label>
              <label className="field">
                سياسة الطلبات المجهولة
                <select
                  value={data.anonymousComplaintsPolicy}
                  onChange={(e) => change('anonymousComplaintsPolicy', e.target.value)}
                >
                  <option value="allowed">مسموح</option>
                  <option value="optional">اختياري</option>
                  <option value="not_allowed">غير مسموح</option>
                </select>
              </label>
              <label className="field">
                لغة الواجهة الافتراضية
                <select
                  value={data.defaultLanguage}
                  onChange={(e) => change('defaultLanguage', e.target.value)}
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="field">
                اللون الأساسي
                <input
                  type="color"
                  value={data.primaryColor || '#0e5f66'}
                  onChange={(e) => change('primaryColor', e.target.value)}
                />
              </label>
              <label className="field">
                لون التمييز
                <input
                  type="color"
                  value={data.accentColor || '#a9782e'}
                  onChange={(e) => change('accentColor', e.target.value)}
                />
              </label>
            </div>

            <hr style={{ margin: '32px 0', borderColor: 'var(--color-border)' }} />
            
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-strong)', marginBottom: '4px' }}>WhatsApp Notifications</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                يجب تفعيل وإعداد مزود WhatsApp قبل استخدام الإرسال الفعلي.
              </p>
            </div>

            <div className="admin-form-grid">
              <div className="field admin-field--full">
                <CheckboxRow
                  label="تفعيل إشعارات WhatsApp (Enable WhatsApp Notifications)"
                  checked={((data.notificationSettings as any)?.whatsapp?.enabled) || false}
                  onChange={(e) => changeSettings('whatsapp', { ...((data.notificationSettings as any)?.whatsapp || {}), enabled: e.target.checked })}
                />
              </div>

              {((data.notificationSettings as any)?.whatsapp?.enabled) && (
                <>
                  <label className="field">
                    المزود (Provider)
                    <select
                      value={((data.notificationSettings as any)?.whatsapp?.provider) || 'meta'}
                      onChange={(e) => changeSettings('whatsapp', { ...((data.notificationSettings as any)?.whatsapp || {}), provider: e.target.value })}
                    >
                      <option value="meta">Meta</option>
                      <option value="twilio">Twilio</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>

                  {((data.notificationSettings as any)?.whatsapp?.provider) === 'meta' && (
                    <label className="field">
                      رقم الهاتف (Phone Number ID)
                      <input
                        dir="ltr"
                        value={((data.notificationSettings as any)?.whatsapp?.phoneNumberId) || ''}
                        onChange={(e) => changeSettings('whatsapp', { ...((data.notificationSettings as any)?.whatsapp || {}), phoneNumberId: e.target.value })}
                      />
                    </label>
                  )}

                  <label className="field">
                    مفتاح الواجهة (API Key / Access Token)
                    <input
                      type="password"
                      dir="ltr"
                      value={((data.notificationSettings as any)?.whatsapp?.apiKey) || ''}
                      onChange={(e) => changeSettings('whatsapp', { ...((data.notificationSettings as any)?.whatsapp || {}), apiKey: e.target.value })}
                      placeholder={((data.notificationSettings as any)?.whatsapp?.apiKey) === '********' ? '********' : ''}
                    />
                  </label>

                  <div className="field admin-field--full" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <CheckboxRow
                      label="إرسال رقم المرجع (Send Complaint Reference)"
                      checked={((data.notificationSettings as any)?.whatsapp?.sendReference) ?? true}
                      onChange={(e) => changeSettings('whatsapp', { ...((data.notificationSettings as any)?.whatsapp || {}), sendReference: e.target.checked })}
                    />
                    <CheckboxRow
                      label="إرسال رمز التتبع (Send Tracking PIN)"
                      checked={((data.notificationSettings as any)?.whatsapp?.sendPin) ?? true}
                      onChange={(e) => changeSettings('whatsapp', { ...((data.notificationSettings as any)?.whatsapp || {}), sendPin: e.target.checked })}
                    />
                  </div>
                </>
              )}
            </div>
            </fieldset>
            {canManage && <footer className="admin-form-footer">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
              </button>
            </footer>}
          </form>
        )}
      </DataState>
    </>
  );
}
