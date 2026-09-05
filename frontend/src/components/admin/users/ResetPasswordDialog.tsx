import { useState, type FormEvent } from 'react';
import { FormDialog } from '../AdminUi';
import { resetUserPassword, type ManagedUser } from '../../../api/usersApi';
import type { ApiClientError } from '../../../api/axiosClient';

interface ResetPasswordDialogProps {
  user: ManagedUser;
  onClose: () => void;
  onReset: (userFullName: string) => void;
}

/**
 * Admin-issued password reset (POST /users/:userId/reset-password, users.manage).
 * The new password is typed by the admin and is never stored, logged, or echoed.
 */
function ResetPasswordDialog({ user, onClose, onReset }: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!newPassword) {
      setError('الرجاء إدخال كلمة المرور الجديدة.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setSaving(true);
    try {
      await resetUserPassword(user.id, newPassword);
      onReset(user.fullName);
    } catch (err) {
      const apiErr = err as ApiClientError;
      // Surface server-side policy messages verbatim; never echo the password.
      setError(apiErr.message || 'تعذر إعادة تعيين كلمة المرور. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      title={`إعادة تعيين كلمة المرور: ${user.fullName}`}
      onClose={onClose}
      onSubmit={submit}
      saving={saving}
      error={error}
      submitLabel="إعادة التعيين"
    >
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

export { ResetPasswordDialog };
export type { ResetPasswordDialogProps };
