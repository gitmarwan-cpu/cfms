import { useState, type FormEvent } from 'react';
import { FormDialog } from '../AdminUi';
import { updateUser, type ManagedUser, type UpdateUserInput } from '../../../api/usersApi';
import type { ApiClientError } from '../../../api/axiosClient';

interface UserEditDialogProps {
  user: ManagedUser;
  onClose: () => void;
  onSaved: (updated: ManagedUser) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Edit-user dialog backed by PUT /users/:userId (users.manage).
 *
 * Supports: fullName, email.
 * primaryOrganizationNodeId is intentionally omitted from this dialog because
 * the organization hierarchy selector requires a backend org-structure endpoint
 * call to list available nodes. The field can be added when that context is
 * available. Raw numeric ID entry is not shown to the user.
 */
export default function UserEditDialog({ user, onClose, onSaved }: UserEditDialogProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setError('الاسم الكامل يجب أن يكون حرفين على الأقل.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('البريد الإلكتروني غير صالح.');
      return;
    }

    const payload: UpdateUserInput = {};
    if (trimmedName !== user.fullName) payload.fullName = trimmedName;
    if (trimmedEmail !== user.email) payload.email = trimmedEmail;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUser(user.id, payload);
      onSaved(updated);
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message || 'تعذر تحديث بيانات المستخدم. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      title={`تعديل: ${user.fullName}`}
      onClose={onClose}
      onSubmit={submit}
      saving={saving}
      error={error}
      submitLabel="حفظ التغييرات"
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
        {user.primaryOrganizationNode && (
          <div className="field admin-field--full">
            <span style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              العقدة التنظيمية الحالية
            </span>
            <span style={{ fontSize: '14px' }}>
              {user.primaryOrganizationNode.legalName}
              {user.primaryOrganizationNode.code && (
                <span style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>
                  ({user.primaryOrganizationNode.code})
                </span>
              )}
            </span>
            <small style={{ display: 'block', marginTop: '4px', color: 'var(--color-text-muted)' }}>
              لتغيير العقدة التنظيمية، استخدم قسم «الهيكل التنظيمي».
            </small>
          </div>
        )}
      </div>
    </FormDialog>
  );
}
