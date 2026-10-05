import { useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../../api/authApi';
import type { ApiClientError } from '../../api/axiosClient';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('رمز إعادة تعيين كلمة المرور مفقود أو غير صالح. يرجى طلب رابط جديد.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('جميع الحقول مطلوبة');
      return;
    }

    if (newPassword.length < 8) {
      setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل');
      return;
    }

    if (!/\d/.test(newPassword)) {
      setError('يجب أن تحتوي كلمة المرور على رقم واحد على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token.trim(), newPassword);
      setIsSuccess(true);
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message || 'فشلت عملية إعادة تعيين كلمة المرور. قد يكون الرابط منتهي الصلاحية أو تم استخدامه بالفعل.');
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
          <h2>تعيين كلمة مرور جديدة</h2>
          <p>أدخل كلمة المرور الجديدة لحسابك</p>
        </div>
        <div className="card__body">
          {isSuccess ? (
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
                تمت إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
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
                الذهاب إلى تسجيل الدخول
              </Link>
            </div>
          ) : !token.trim() ? (
            <div style={{ textAlign: 'center' }}>
              <div className="alert alert-danger" style={{ marginBottom: '20px', lineHeight: '1.6' }}>
                رابط إعادة تعيين كلمة المرور غير صالح أو مفقود. يرجى طلب رابط جديد لاسترداد الحساب.
              </div>
              <Link
                to="/forgot-password"
                className="btn btn-primary"
                style={{
                  display: 'inline-block',
                  width: '100%',
                  textAlign: 'center',
                  textDecoration: 'none',
                  marginBottom: '12px',
                }}
              >
                طلب رابط استرداد جديد
              </Link>
              <Link
                to="/admin/login"
                style={{
                  color: 'var(--color-text-muted)',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                }}
              >
                العودة إلى تسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form-grid form-grid--single">
              {error && (
                <div>
                  <div className="alert alert-danger" style={{ marginBottom: '10px' }}>
                    {error}
                  </div>
                  {(error.includes('منتهي الصلاحية') || error.includes('غير صالح')) && (
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                      <Link
                        to="/forgot-password"
                        style={{
                          color: 'var(--color-primary, #2563eb)',
                          fontSize: '0.88rem',
                          textDecoration: 'none',
                        }}
                      >
                        طلب رابط استرداد جديد
                      </Link>
                    </div>
                  )}
                </div>
              )}
              <div className="field">
                <label htmlFor="newPassword">كلمة المرور الجديدة</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  placeholder="8 أحرف على الأقل ورقم واحد"
                  required
                />
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                  يجب أن تكون 8 أحرف على الأقل وتتضمن رقماً واحداً.
                </small>
              </div>
              <div className="field" style={{ marginTop: '12px' }}>
                <label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="submit-row" style={{ marginTop: '18px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'جارٍ الحفظ...' : 'تأكيد وحفظ كلمة المرور'}
                </button>
              </div>
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Link
                  to="/admin/login"
                  style={{
                    color: 'var(--color-text-muted)',
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
