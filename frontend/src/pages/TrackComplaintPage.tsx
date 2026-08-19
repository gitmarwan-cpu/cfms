import { useState, type FormEvent } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { trackComplaint, type TrackedComplaint } from '../api/complaintApi';

const STATUS_STEPS = ['new', 'in_review', 'resolved', 'closed'];

export default function TrackComplaintPage() {
  const { orgSlug } = useOrganization() || {};
  const [referenceCode, setReferenceCode] = useState('');
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<TrackedComplaint | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!referenceCode.trim() || pin.trim().length !== 6) {
      setError('الرجاء إدخال الرقم المرجعي ورمز متابعة مكوّن من 6 أرقام');
      return;
    }

    setLoading(true);
    try {
      const data = await trackComplaint(orgSlug, referenceCode.trim(), pin.trim());
      setResult(data);
    } catch (error) {
      const err = error as { message?: string };
      setError(err.message || 'تعذر العثور على طلب مطابق لهذه البيانات');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = result ? STATUS_STEPS.indexOf(result.status) : -1;

  return (
    <div className="card">
      <div className="card__header">
        <h2>متابعة طلب</h2>
        <p>أدخل الرقم المرجعي ورمز المتابعة (PIN) اللذين حصلت عليهما عند تقديم طلبك</p>
      </div>
      <div className="card__body">
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="referenceCode">الرقم المرجعي</label>
            <input
              id="referenceCode"
              type="text"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              placeholder="CFMS-2026-000123"
            />
          </div>
          <div className="field">
            <label htmlFor="pin">رمز المتابعة (PIN)</label>
            <input
              id="pin"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="6 أرقام"
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'جارٍ البحث...' : 'عرض حالة الطلب'}
          </button>
        </form>

        {result && (
          <div className="tracking-result">
            <h3>{result.statusLabel}</h3>
            {result.status === 'rejected' ? (
              <p className="tracking-status-final">{result.statusLabel}</p>
            ) : (
              <ol className="tracking-steps">
                {STATUS_STEPS.map((step, index) => (
                  <li key={step} className={index <= currentStepIndex ? 'is-done' : ''}>
                    {step === 'new' && 'تم استلام الطلب'}
                    {step === 'in_review' && 'قيد المراجعة'}
                    {step === 'resolved' && 'تم الحل'}
                    {step === 'closed' && 'أُغلق'}
                  </li>
                ))}
              </ol>
            )}
            <p>تاريخ الإرسال: {new Date(result.submittedAt).toLocaleDateString('ar')}</p>
            <p>آخر تحديث: {new Date(result.lastUpdatedAt).toLocaleDateString('ar')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
