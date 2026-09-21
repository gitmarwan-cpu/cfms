import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ApiClientError } from '../../api/axiosClient';
import { provisionTenant, type ProvisionedTenant, type TenantProvisioningInput } from '../../api/platformApi';
import { PageHeader } from '../../components/patterns/PageHeader';
import LocationSelect from '../../components/LocationSelect';
import { Input, Textarea } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/dateTime';

interface TenantProvisioningFormState {
  legalName: string;
  slug: string;
  shortName: string;
  description: string;
  countryId: string;
  governorateId: string;
  districtId: string;
  email: string;
  website: string;
  initialAdminFullName: string;
  initialAdminEmail: string;
  initialAdminPassword: string;
}

const emptyForm: TenantProvisioningFormState = {
  legalName: '',
  slug: '',
  shortName: '',
  description: '',
  countryId: '',
  governorateId: '',
  districtId: '',
  email: '',
  website: '',
  initialAdminFullName: '',
  initialAdminEmail: '',
  initialAdminPassword: '',
};

const optionalNumber = (value: string): number | null => (value ? Number(value) : null);

export default function TenantProvisioningPage() {
  const [form, setForm] = useState<TenantProvisioningFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProvisionedTenant | null>(null);

  const change = (key: keyof TenantProvisioningFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload: TenantProvisioningInput = {
      legalName: form.legalName.trim(),
      slug: form.slug.trim().toLowerCase(),
      shortName: form.shortName.trim() || null,
      description: form.description.trim() || null,
      countryId: optionalNumber(form.countryId),
      governorateId: optionalNumber(form.governorateId),
      districtId: optionalNumber(form.districtId),
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      initialAdmin: {
        fullName: form.initialAdminFullName.trim(),
        email: form.initialAdminEmail.trim(),
        password: form.initialAdminPassword,
      },
    };

    try {
      setResult(await provisionTenant(payload));
    } catch (err) {
      setError((err as ApiClientError).message || 'تعذر تهيئة المستأجر.');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div>
        <PageHeader title="تمت تهيئة المستأجر" description="اكتملت عملية الإنشاء والتهيئة بنجاح." />
        <section className="card">
          <div className="card__body">
            <div className="admin-success" role="status">تم إنشاء المستأجر والحساب الأولي لمدير المستأجر.</div>
            <dl className="admin-detail-grid">
              <div><dt>اسم المؤسسة</dt><dd>{result.organization.legalName}</dd></div>
              <div><dt>المعرّف (slug)</dt><dd dir="ltr">{result.organization.slug}</dd></div>
              <div><dt>الحالة</dt><dd><StatusBadge tone="success">{result.organization.lifecycleStatus}</StatusBadge></dd></div>
              <div><dt>وقت التفعيل</dt><dd>{formatDateTime(result.organization.statusChangedAt)}</dd></div>
              <div><dt>مدير المستأجر الأول</dt><dd>{result.initialAdmin.fullName}</dd></div>
              <div><dt>بريد مدير المستأجر</dt><dd dir="ltr">{result.initialAdmin.email}</dd></div>
              <div><dt>المعرّف الجذري</dt><dd>{result.rootOrganizationNode.id}</dd></div>
              <div><dt>الدور الأولي</dt><dd>{result.tenantRole.code}</dd></div>
            </dl>
            <div className="admin-form-footer">
              <Link className="btn btn-primary" to="/admin/platform">العودة إلى إدارة المنصة</Link>
              <button className="btn btn-outline" type="button" onClick={() => { setForm(emptyForm); setResult(null); }}>تهيئة مستأجر آخر</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="تهيئة مستأجر"
        description="إنشاء مؤسسة جديدة مع العقدة الجذرية والحساب الأولي لمدير المستأجر في عملية واحدة."
      />

      {error && <div className="admin-state admin-state--error" role="alert"><p>{error}</p></div>}

      <form className="card admin-settings-form" onSubmit={submit}>
        <div className="card__body">
          <h2 className="admin-section-title">بيانات المؤسسة</h2>
          <div className="admin-form-grid">
            <Input label="الاسم القانوني" value={form.legalName} onChange={(event) => change('legalName', event.target.value)} maxLength={200} required />
            <Input label="معرّف المؤسسة (slug)" dir="ltr" value={form.slug} onChange={(event) => change('slug', event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} required hint="أحرف لاتينية صغيرة وأرقام وشرطات فقط." />
            <Input label="الاسم المختصر" value={form.shortName} onChange={(event) => change('shortName', event.target.value)} maxLength={80} />
            <Input label="البريد الإلكتروني للمؤسسة" type="email" dir="ltr" value={form.email} onChange={(event) => change('email', event.target.value)} />
            <Input label="الموقع الإلكتروني" type="url" dir="ltr" value={form.website} onChange={(event) => change('website', event.target.value)} />
            <Textarea label="الوصف" value={form.description} onChange={(event) => change('description', event.target.value)} />
            <div className="admin-field--full">
              <LocationSelect
                showCountry
                isRequired={false}
                countryId={form.countryId}
                governorateId={form.governorateId}
                districtId={form.districtId}
                onCountryChange={(value) => change('countryId', value)}
                onGovernorateChange={(value) => change('governorateId', value)}
                onDistrictChange={(value) => change('districtId', value)}
              />
            </div>
          </div>

          <h2 className="admin-section-title">مدير المستأجر الأول</h2>
          <div className="admin-form-grid">
            <Input label="الاسم الكامل" value={form.initialAdminFullName} onChange={(event) => change('initialAdminFullName', event.target.value)} maxLength={150} required autoComplete="name" />
            <Input label="البريد الإلكتروني" type="email" dir="ltr" value={form.initialAdminEmail} onChange={(event) => change('initialAdminEmail', event.target.value)} required autoComplete="email" />
            <Input label="كلمة المرور" type="password" dir="ltr" value={form.initialAdminPassword} onChange={(event) => change('initialAdminPassword', event.target.value)} minLength={8} required autoComplete="new-password" hint="ثمانية أحرف على الأقل وتتضمن رقماً." />
          </div>
          <p className="admin-page-description">سيُنشأ الحساب نشطاً، وتُسند إليه عضوية ودور مدير المستأجر تلقائياً ضمن عملية التهيئة.</p>
        </div>
        <footer className="admin-form-footer">
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'جارٍ التهيئة…' : 'تهيئة المستأجر'}</button>
        </footer>
      </form>
    </div>
  );
}
