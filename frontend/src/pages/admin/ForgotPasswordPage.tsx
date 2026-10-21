import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/authApi';
import type { ApiClientError } from '../../api/axiosClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDevResetUrl(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('البريد الإلكتروني مطلوب');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(trimmedEmail);
      setSuccessMessage(
        res.message || 'إذا كان البريد الإلكتروني مرتبطاً بحساب، فسيتم إرسال تعليمات إعادة التعيين إليه'
      );
      if (res.resetUrl || res.devResetUrl) {
        setDevResetUrl(res.resetUrl || res.devResetUrl || null);
      }
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message || 'حدث خطأ أثناء معالجة طلبك، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="app-shell"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="card__header" style={{ textAlign: 'center' }}>
          <h2>استرداد كلمة المرور</h2>
          <p>أدخل بريدك الإلكتروني المسجل لإرسال تعليمات إعادة التعيين</p>
        </div>
        <div className="card__body">
          {successMessage ? (
            <div style={{ textAlign: 'center' }}>
              <div
                className="alert"
                style={{
                  background: 'var(--color-success-bg, #e7f5ee)',
                  color: 'var(--color-success, #1c7c4c)',
                  marginBottom: '20px',
                  lineHeight: '1.6',
                }}
              >
                {successMessage}
              </div>
              {devResetUrl && (
                <div
                  className="alert alert-info"
                  style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    color: '#0369a1',
                    padding: '14px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    textAlign: 'start',
                    fontSize: '0.88rem',
                    lineHeight: '1.5',
                  }}
                >
                  <p style={{ fontWeight: 600, margin: '0 0 6px 0', color: '#0369a1' }}>
                    [بيئة التطوير] تعذّر إرسال البريد الإلكتروني. يمكنك استخدام الرابط المباشر التالي:
                  </p>
                  <div style={{ wordBreak: 'break-all', marginBottom: '10px' }}>
                    <a
                      href={devResetUrl}
                      style={{ color: '#0284c7', textDecoration: 'underline' }}
                    >
                      {devResetUrl}
                    </a>
                  </div>
                  <Link
                    to={(() => {
                      try {
                        const parsed = new URL(devResetUrl, window.location.origin);
                        return parsed.pathname + parsed.search;
                      } catch {
                        return '/reset-password';
                      }
                    })()}
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-block',
                      width: '100%',
                      textAlign: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    متابعة إعادة التعيين عبر الرابط
                  </Link>
                </div>
              )}
              <Link
                to="/admin/login"
                className="btn btn-primary"
                style={{
                  display: 'inline-block',
                  width: '100%',
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                العودة إلى تسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid form-grid--single">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="field">
                <label htmlFor="email">البريد الإلكتروني</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="submit-row" style={{ marginTop: '16px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'جارٍ الإرسال...' : 'إرسال تعليمات إعادة التعيين'}
                </button>
              </div>
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Link
                  to="/admin/login"
                  style={{
                    color: 'var(--color-primary, #2563eb)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                  }}
                >
                  العودة إلى تسجيل الدخول
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
