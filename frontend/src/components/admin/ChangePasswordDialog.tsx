import { useState, type FormEvent } from 'react';
import { FormDialog } from './AdminUi';
import { changePassword } from '../../api/authApi';
import type { ApiClientError } from '../../api/axiosClient';

/**
 * Self-service password change dialog ("تغيير كلمة المرور" under the account menu).
 * POST /auth/change-password — account-level, authenticated only.
 */
export default function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!currentPassword || !newPassword) {
      setError('الرجاء إدخال كلمة المرور الحالية والجديدة.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      onClose();
    } catch (err) {
      const apiErr = err as ApiClientError;
      // Surface the server message verbatim (policy violations included) —
      // no invented friendlier copy, and no password material is ever shown.
      setError(apiErr.message || 'تعذر تغيير كلمة المرور. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      title="تغيير كلمة المرور"
      onClose={onClose}
      onSubmit={submit}
      saving={saving}
      error={error}
      submitLabel="تغيير كلمة المرور"
    >
      <label className="field">
        كلمة المرور الحالية
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <label className="field">
        كلمة المرور الجديدة
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="field">
        تأكيد كلمة المرور الجديدة
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
    </FormDialog>
  );
}