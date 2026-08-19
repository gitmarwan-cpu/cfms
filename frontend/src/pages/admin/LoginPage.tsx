import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import type { ApiClientError } from '../../api/axiosClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('البريد الإلكتروني وكلمة المرور مطلوبان');
      return;
    }

    setLoading(true);
    try {
      const res = await loginApi(email, password);
      login(res.token, res.user);
      navigate('/admin', { replace: true });
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message || 'فشل تسجيل الدخول. يرجى التحقق من بيانات الاعتماد والمحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="card__header" style={{ textAlign: 'center' }}>
          <h2>تسجيل الدخول</h2>
          <p>أدخل بيانات اعتمادك للوصول إلى لوحة التحكم</p>
        </div>
        <div className="card__body">
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
            <div className="field">
              <label htmlFor="password">كلمة المرور</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="submit-row" style={{ marginTop: '16px' }}>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'جاري تسجيل الدخول...' : 'دخول'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
