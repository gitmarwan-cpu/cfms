import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/authApi';
import type { ApiClientError } from '../../api/axiosClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
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
