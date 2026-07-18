import { useEffect, useState } from 'react';
import LocationSelect from './LocationSelect';
import { fetchGovernorates } from '../api/locationApi';
import { submitComplaint } from '../api/complaintApi';

const CATEGORY_OPTIONS = [
  { value: 'service_quality', label: 'جودة الخدمة' },
  { value: 'staff_behavior', label: 'سلوك موظف' },
  { value: 'corruption_fraud', label: 'فساد / احتيال' },
  { value: 'distribution_issue', label: 'مشكلة في التوزيع' },
  { value: 'protection_gbv', label: 'حماية / عنف قائم على النوع الاجتماعي (حساسة)' },
  { value: 'suggestion', label: 'مقترح تحسين' },
  { value: 'other', label: 'أخرى' },
];

const CHANNEL_OPTIONS = [
  { value: 'website', label: 'الموقع الإلكتروني' },
  { value: 'in_person', label: 'حضوري' },
  { value: 'hotline', label: 'الخط الساخن' },
  { value: 'suggestion_box', label: 'صندوق الاقتراحات' },
  { value: 'email', label: 'البريد الإلكتروني' },
  { value: 'field_visit', label: 'زيارة ميدانية' },
];

const AGE_GROUP_OPTIONS = [
  { value: 'under_18', label: 'أقل من 18' },
  { value: '18_30', label: '18 - 30' },
  { value: '31_45', label: '31 - 45' },
  { value: '46_60', label: '46 - 60' },
  { value: 'above_60', label: 'أكثر من 60' },
];

const initialState = {
  type: 'complaint',
  isAnonymous: false,
  fullName: '',
  gender: '',
  ageGroup: '',
  phone: '',
  email: '',
  governorateId: '',
  districtId: '',
  village: '',
  category: '',
  isSensitive: false,
  description: '',
  desiredResolution: '',
  channel: 'website',
  consentGiven: false,
};

export default function ComplaintForm({ onSuccess }) {
  const [governorates, setGovernorates] = useState([]);
  const [values, setValues] = useState(initialState);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  useEffect(() => {
    fetchGovernorates()
      .then(setGovernorates)
      .catch(() => setGlobalError('تعذر تحميل قائمة المحافظات، الرجاء إعادة تحميل الصفحة'));
  }, []);

  const setField = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []).slice(0, 3);
    setFiles(selected);
  };

  const validateClientSide = () => {
    const nextErrors = {};
    if (!values.isAnonymous && !values.fullName.trim()) {
      nextErrors.fullName = 'الاسم مطلوب ما لم تختر تقديم الطلب بشكل مجهول';
    }
    if (!values.governorateId) nextErrors.governorateId = 'المحافظة مطلوبة';
    if (!values.districtId) nextErrors.districtId = 'المديرية مطلوبة';
    if (!values.category) nextErrors.category = 'يرجى اختيار تصنيف الطلب';
    if (!values.description.trim() || values.description.trim().length < 10) {
      nextErrors.description = 'وصف الشكوى/المقترح مطلوب (10 أحرف على الأقل)';
    }
    if (!values.consentGiven) {
      nextErrors.consentGiven = 'يجب الموافقة على معالجة البيانات لإتمام التقديم';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');

    if (!validateClientSide()) return;

    setSubmitting(true);
    try {
      const payload = { ...values };
      const result = await submitComplaint(payload, files);
      onSuccess(result);
    } catch (err) {
      if (err.details && err.details.length > 0) {
        const fieldErrors = {};
        err.details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setErrors(fieldErrors);
      }
      setGlobalError(err.message || 'تعذر إرسال الطلب، الرجاء المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit} noValidate>
      {globalError && <div className="alert alert-danger">{globalError}</div>}

      <div className="field field--span-2">
        <label>
          نوع التقديم <span className="required">*</span>
        </label>
        <div className="type-toggle" role="group" aria-label="نوع التقديم">
          <button
            type="button"
            aria-pressed={values.type === 'complaint'}
            onClick={() => setField('type', 'complaint')}
          >
            شكوى
          </button>
          <button
            type="button"
            aria-pressed={values.type === 'proposal'}
            onClick={() => setField('type', 'proposal')}
          >
            مقترح
          </button>
        </div>
      </div>

      <div className="divider-label">بيانات مقدّم الطلب</div>

      <div className="field field--span-2">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={values.isAnonymous}
            onChange={(e) => setField('isAnonymous', e.target.checked)}
          />
          أرغب في تقديم الطلب دون الإفصاح عن هويتي (مجهول الاسم)
        </label>
      </div>

      {!values.isAnonymous && (
        <>
          <div className="field">
            <label htmlFor="fullName">
              اسم مقدّم النموذج <span className="required">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              value={values.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
            />
            {errors.fullName && <span className="field-error">{errors.fullName}</span>}
          </div>

          <div className="field">
            <label htmlFor="phone">رقم الهاتف</label>
            <input
              id="phone"
              type="tel"
              value={values.phone}
              onChange={(e) => setField('phone', e.target.value)}
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>

          <div className="field">
            <label htmlFor="email">البريد الإلكتروني (اختياري)</label>
            <input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="gender">الجنس</label>
            <select id="gender" value={values.gender} onChange={(e) => setField('gender', e.target.value)}>
              <option value="">-- غير محدد --</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="ageGroup">الفئة العمرية</label>
            <select
              id="ageGroup"
              value={values.ageGroup}
              onChange={(e) => setField('ageGroup', e.target.value)}
            >
              <option value="">-- غير محدد --</option>
              {AGE_GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="divider-label">الموقع</div>

      <LocationSelect
        governorates={governorates}
        governorateId={values.governorateId}
        districtId={values.districtId}
        onGovernorateChange={(v) => setField('governorateId', v)}
        onDistrictChange={(v) => setField('districtId', v)}
        errors={errors}
      />

      <div className="field">
        <label htmlFor="village">القرية / الحي (اختياري)</label>
        <input
          id="village"
          type="text"
          value={values.village}
          onChange={(e) => setField('village', e.target.value)}
        />
      </div>

      <div className="divider-label">تفاصيل {values.type === 'complaint' ? 'الشكوى' : 'المقترح'}</div>

      <div className="field">
        <label htmlFor="category">
          التصنيف <span className="required">*</span>
        </label>
        <select
          id="category"
          value={values.category}
          onChange={(e) => setField('category', e.target.value)}
        >
          <option value="">-- اختر التصنيف --</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.category && <span className="field-error">{errors.category}</span>}
      </div>

      <div className="field">
        <label htmlFor="channel">قناة التقديم</label>
        <select id="channel" value={values.channel} onChange={(e) => setField('channel', e.target.value)}>
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field field--span-2">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={values.isSensitive}
            onChange={(e) => setField('isSensitive', e.target.checked)}
          />
          هذه شكوى حساسة (مثل استغلال، عنف، أو فساد) وتتطلب مساراً سرّياً خاصاً
        </label>
      </div>

      <div className="field field--span-2">
        <label htmlFor="description">
          تفاصيل الشكوى / المقترح <span className="required">*</span>
        </label>
        <textarea
          id="description"
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="يرجى وصف الموضوع بالتفصيل..."
        />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </div>

      <div className="field field--span-2">
        <label htmlFor="desiredResolution">الحل المقترح من وجهة نظرك (اختياري)</label>
        <textarea
          id="desiredResolution"
          value={values.desiredResolution}
          onChange={(e) => setField('desiredResolution', e.target.value)}
        />
      </div>

      <div className="field field--span-2">
        <label htmlFor="attachments">المرفقات (اختياري، حتى 3 ملفات: صور أو PDF)</label>
        <input id="attachments" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileChange} />
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="field field--span-2">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={values.consentGiven}
            onChange={(e) => setField('consentGiven', e.target.checked)}
          />
          أوافق على معالجة بياناتي لغرض متابعة هذا الطلب <span className="required">*</span>
        </label>
        {errors.consentGiven && <span className="field-error">{errors.consentGiven}</span>}
      </div>

      <div className="submit-row">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
        </button>
      </div>
    </form>
  );
}
