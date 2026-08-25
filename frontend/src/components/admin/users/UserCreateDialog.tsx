import { useState, type FormEvent } from 'react';
import { FormDialog } from '../AdminUi';
import { registerUser, type ManagedUser } from '../../../api/usersApi';
import type { Role } from '../../../api/adminApi';
import type { ApiClientError } from '../../../api/axiosClient';

interface UserCreateDialogProps {
  /** Roles visible in the active organization (used for the initial roleCode). */
  roles: Role[];
  onClose: () => void;
  onCreated: (user: ManagedUser) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Modern create-user dialog backed by POST /auth/register (users.manage). */
export default function UserCreateDialog({ roles, onClose, onCreated }: UserCreateDialogProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const assignableRoles = roles.filter((role) => role.isActive);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) {
      setError('الاسم الكامل مطلوب (حرفان على الأقل).');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('البريد الإلكتروني غير صالح.');
      return;
    }
    if (password.length < 8 || !/\d/.test(password)) {
      setError('كلمة المرور يجب ألا تقل عن 8 أحرف وأن تحتوي على رقم واحد على الأقل.');
      return;
    }

    setSaving(true);
    try {
      const created = await registerUser({
        fullName: trimmedName,
        email: trimmedEmail,
        password,
        ...(roleCode ? { roleCode } : {}),
      });
      onCreated(created);
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message || 'تعذر إنشاء المستخدم. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      title="إضافة مستخدم"
      onClose={onClose}
      onSubmit={submit}
      saving={saving}
      error={error}
      submitLabel="إنشاء المستخدم"
    >
      <div className="admin-form-grid">
        <label className="field admin-field--full">
          الاسم الكامل
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
            maxLength={150}
          />
        </label>
        <label className="field admin-field--full">
          البريد الإلكتروني
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="field admin-field--full">
          كلمة المرور
          <input
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <small>8 أحرف على الأقل ويجب أن تحتوي على رقم واحد.</small>
        </label>
        <label className="field admin-field--full">
          الدور الابتدائي (اختياري)
          <select value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
            <option value="">دور النظام الافتراضي (staff)</option>
            {assignableRoles.map((role) => (
              <option key={role.id} value={role.code}>
                {role.nameAr}
                {role.isSystem ? ' (نظامي)' : ''}
              </option>
            ))}
          </select>
          <small>يُسنَد تلقائياً دور «staff» إذا لم تُحدد؛ يمكن إسناد أدوار إضافية لاحقاً.</small>
        </label>
      </div>
    </FormDialog>
  );
}