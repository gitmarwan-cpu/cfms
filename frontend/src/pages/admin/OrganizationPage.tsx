import { useEffect, useState, type FormEvent } from 'react';
import { createOrganization, fetchOrganization, updateOrganization, type OrganizationSettings } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { DataState, FormDialog } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import LocationSelect from '../../components/LocationSelect';
import { useAuth } from '../../context/AuthContext';
import { CheckboxRow } from '../../components/ui/Checkbox';

interface CreateOrganizationFormState {
  legalName: string;
  slug: string;
  shortName: string;
  email: string;
  website: string;
  countryId: string;
  governorateId: string;
  districtId: string;
}

const emptyCreateForm: CreateOrganizationFormState = {
  legalName: '',
  slug: '',
  shortName: '',
  email: '',
  website: '',
  countryId: '',
  governorateId: '',
  districtId: '',
};

export default function OrganizationPage() {
  const { user, hasPermission, currentOrganizationId } = useAuth();
  const canManage = currentOrganizationId !== null && currentOrganizationId !== undefined
    && hasPermission('organization.manage', currentOrganizationId);
  const canCreateOrganization = currentOrganizationId !== null && currentOrganizationId !== undefined
    && hasPermission('organization.create', currentOrganizationId);
  const [data, setData] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  // Create Organization (tenant) — distinct from creating an organizational unit
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrganizationFormState>(emptyCreateForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

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

  const changeCreate = (key: keyof CreateOrganizationFormState, value: string) =>
    setCreateForm((v) => ({ ...v, [key]: value }));

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.legalName.trim() || !createForm.slug.trim()) {
      setCreateError('اسم المؤسسة ومعرّفها (slug) مطلوبان.');
      return;
    }
    setCreateSaving(true);
    try {
      const created = await createOrganization({
        legalName: createForm.legalName.trim(),
        slug: createForm.slug.trim().toLowerCase(),
        shortName: createForm.shortName.trim() || null,
        email: createForm.email.trim() || null,
        website: createForm.website.trim() || null,
        countryId: createForm.countryId ? parseInt(createForm.countryId, 10) : null,
        governorateId: createForm.governorateId ? parseInt(createForm.governorateId, 10) : null,
        districtId: createForm.districtId ? parseInt(createForm.districtId, 10) : null,
      });
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      setNotice(`تم إنشاء المؤسسة «${created.legalName}» بنجاح مع وحدتها الجذرية تلقائياً. أُضيفت عضوية للمؤسسة الجديدة إلى حسابك.`);
    } catch (err) {
      setCreateError((err as ApiClientError).message);
    } finally {
      setCreateSaving(false);
    }
  };

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
      {canCreateOrganization && (
        <div className="card" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <strong>إنشاء مؤسسة جديدة</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '.85rem' }}>
              تنشئ مؤسسة (Tenant) جديدة مع وحدتها التنظيمية الجذرية تلقائياً — منفصل تماماً عن إنشاء الوحدات التنظيمية داخل المؤسسة الحالية.
            </p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => { setCreateError(''); setCreateOpen(true); }}
          >
            + إنشاء مؤسسة
          </button>
        </div>
      )}
      {createOpen && (
        <FormDialog
          title="إنشاء مؤسسة جديدة"
          onClose={() => setCreateOpen(false)}
          onSubmit={submitCreate}
          saving={createSaving}
          error={createError}
          submitLabel="إنشاء المؤسسة"
        >
          <div className="admin-form-grid">
            <label className="field">
              الاسم القانوني *
              <input
                value={createForm.legalName}
                onChange={(e) => changeCreate('legalName', e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              معرّف البوابة (slug) *
              <input
                dir="ltr"
                value={createForm.slug}
                onChange={(e) => changeCreate('slug', e.target.value)}
                placeholder="example: human-access"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
                maxLength={80}
              />
              <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
                يُستخدم في رابط البوابة العامة ويجب أن يكون فريداً.
              </small>
            </label>
            <label className="field">
              الاسم المختصر
              <input
                value={createForm.shortName}
                onChange={(e) => changeCreate('shortName', e.target.value)}
                maxLength={80}
              />
            </label>
            <label className="field">
              البريد الإلكتروني
              <input
                type="email"
                dir="ltr"
                value={createForm.email}
                onChange={(e) => changeCreate('email', e.target.value)}
              />
            </label>
            <label className="field">
              الموقع الإلكتروني
              <input
                type="url"
                dir="ltr"
                value={createForm.website}
                onChange={(e) => changeCreate('website', e.target.value)}
              />
            </label>
            <div className="admin-field--full">
              <LocationSelect
                showCountry
                isRequired={false}
                countryId={createForm.countryId}
                governorateId={createForm.governorateId}
                districtId={createForm.districtId}
                onCountryChange={(val) => {
                  changeCreate('countryId', val);
                  changeCreate('governorateId', '');
                  changeCreate('districtId', '');
                }}
                onGovernorateChange={(val) => {
                  changeCreate('governorateId', val);
                  changeCreate('districtId', '');
                }}
                onDistrictChange={(val) => changeCreate('districtId', val)}
              />
            </div>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '.82rem', marginTop: '8px' }}>
            سيتم إنشاء الوحدة التنظيمية الجذرية (type = organization, بلا وحدة أم) تلقائياً كجزء من نفس العملية،
            وستُضاف أنواع الوحدات الافتراضية (فرع / قطاع، قسم) للمؤسسة الجديدة.
          </p>
        </FormDialog>
      )}
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
