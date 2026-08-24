import { useEffect, useState, type FormEvent } from 'react';
import { fetchOrganization, updateOrganization, type OrganizationSettings } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { DataState, PageHeader } from '../../components/admin/AdminUi';
import LocationSelect from '../../components/LocationSelect';

export default function OrganizationPage() {
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
            <footer className="admin-form-footer">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
              </button>
            </footer>
          </form>
        )}
      </DataState>
    </>
  );
}
