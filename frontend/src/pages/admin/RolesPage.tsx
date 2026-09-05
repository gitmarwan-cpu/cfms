import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { createRole, deleteRole, fetchPermissions, fetchRoles, updateRole, type Permission, type Role } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { ConfirmDialog, DataState, FormDialog } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { Building2, Globe, Lock, Plus } from 'lucide-react';
import { CheckboxRow } from '../../components/ui/Checkbox';

type Draft = { code: string; nameAr: string; nameEn: string; description: string; isActive: boolean; permissionIds: number[] };
const empty: Draft = { code: '', nameAr: '', nameEn: '', description: '', isActive: true, permissionIds: [] };

// Human-readable Arabic labels for the permission modules returned by the API.
const MODULE_LABELS: Record<string, string> = {
  organization: 'المؤسسة',
  reference_data: 'البيانات المرجعية',
  org_structure: 'الهيكل التنظيمي',
  users: 'المستخدمون',
  complaints: 'الشكاوى والاقتراحات',
  audit: 'سجل التدقيق',
};
const moduleLabel = (module?: string | null) => MODULE_LABELS[module ?? ''] || module || 'عام';

export default function RolesPage() {
  const { hasPermission, currentOrganizationId } = useAuth();
  const canManage = currentOrganizationId !== null && currentOrganizationId !== undefined
    && hasPermission('roles.manage', currentOrganizationId);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Role | null | undefined>();
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([fetchRoles(), fetchPermissions()])
      .then(([nextRoles, nextPermissions]) => {
        setRoles(nextRoles);
        setPermissions(nextPermissions);
      })
      .catch((e: ApiClientError) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Group the flat permission list by its module so the form is navigable
  // instead of a wall of unrelated checkboxes.
  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const key = p.module ?? 'general';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].sort((a, b) => moduleLabel(a[0]).localeCompare(moduleLabel(b[0]), 'ar'));
  }, [permissions]);

  const open = (role?: Role) => {
    setEditing(role ?? null);
    setFormError('');
    setDraft(role
      ? { code: role.code, nameAr: role.nameAr, nameEn: role.nameEn || '', description: role.description || '', isActive: role.isActive, permissionIds: role.permissions.map((p) => p.id) }
      : empty);
  };

  const togglePermission = (id: number, checked: boolean) => {
    setDraft({ ...draft, permissionIds: checked ? [...draft.permissionIds, id] : draft.permissionIds.filter((x) => x !== id) });
  };

  const toggleGroup = (group: Permission[], checked: boolean) => {
    const ids = new Set(draft.permissionIds);
    for (const p of group) { if (checked) ids.add(p.id); else ids.delete(p.id); }
    setDraft({ ...draft, permissionIds: [...ids] });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!draft.nameAr.trim() || (!editing && !draft.code.trim())) {
      setFormError('الاسم والرمز مطلوبان.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateRole(editing.id, { nameAr: draft.nameAr, nameEn: draft.nameEn || null, description: draft.description || null, isActive: draft.isActive, permissionIds: draft.permissionIds });
      } else {
        await createRole({ code: draft.code, nameAr: draft.nameAr, nameEn: draft.nameEn || null, description: draft.description || null, permissionIds: draft.permissionIds });
      }
      setEditing(undefined);
      load();
    } catch (e) {
      setFormError((e as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await deleteRole(deleting.id);
      setDeleting(null);
      load();
    } catch (e) {
      setError((e as ApiClientError).message);
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="الأدوار والصلاحيات"
        description="إدارة أدوار المؤسسة وتحديد الصلاحيات المرتبطة بها لكل وحدة عمل."
        actions={canManage && (
          <button className="btn btn-primary" onClick={() => open()}>
            <Plus size={16} aria-hidden="true" /> إضافة دور
          </button>
        )}
      />
      <DataState loading={loading} error={error} empty={!roles.length} onRetry={load}>
        <div className="card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الدور</th>
                  <th>الرمز</th>
                  <th>الصلاحيات</th>
                  <th>النطاق</th>
                  <th>الحالة</th>
                  {canManage && <th>إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <span className="role-name">
                        <strong>{role.nameAr}</strong>
                        {role.isSystem && (
                          <span className="role-badge role-badge--system" title="دور نظامي محمي لا يمكن حذفه">
                            <Lock size={12} aria-hidden="true" /> نظامي
                          </span>
                        )}
                      </span>
                      {role.description && <small className="admin-muted role-desc">{role.description}</small>}
                    </td>
                    <td className="role-code" dir="ltr">{role.code}</td>
                    <td><span className="role-perm-count">{role.permissions.length}</span></td>
                    <td>
                      <span className="role-scope">
                        {role.isSystem ? <Globe size={13} aria-hidden="true" /> : <Building2 size={13} aria-hidden="true" />}
                        {role.isSystem ? 'عام' : 'المؤسسة'}
                      </span>
                    </td>
                    <td><StatusBadge tone={role.isActive ? 'success' : 'neutral'}>{role.isActive ? 'نشط' : 'معطّل'}</StatusBadge></td>
                    {canManage && (
                      <td className="admin-actions">
                        <button className="btn btn-outline" onClick={() => open(role)}>تعديل</button>
                        {!role.isSystem && (
                          <button className="admin-text-button danger" onClick={() => setDeleting(role)}>حذف</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DataState>

      {editing !== undefined && canManage && (
        <FormDialog
          title={editing ? 'تعديل الدور' : 'إضافة دور'}
          onClose={() => setEditing(undefined)}
          onSubmit={submit}
          saving={saving}
          error={formError}
        >
          <div className="admin-form-grid">
            {!editing && (
              <label className="field">
                الرمز
                <input dir="ltr" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required pattern="[a-z0-9_]+" />
              </label>
            )}
            <label className="field">
              الاسم بالعربية
              <input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} required />
            </label>
            <label className="field">
              الاسم بالإنجليزية
              <input dir="ltr" value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
            </label>
            <label className="field admin-field--full">
              الوصف
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <label className="field admin-field--full">
              <span>الحالة</span>
              <CheckboxRow
                label="نشط"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
            </label>
            <fieldset className="admin-field--full role-perm-fieldset">
              <legend>الصلاحيات</legend>
              <div className="role-perm-groups">
                {groups.map(([moduleKey, perms]) => {
                  const all = perms.every((p) => draft.permissionIds.includes(p.id));
                  return (
                    <div className="role-perm-group" key={moduleKey}>
                      <div className="role-perm-group-head">
                        <span className="role-perm-group-title">{moduleLabel(moduleKey)}</span>
                        <button type="button" className="admin-text-button role-perm-toggle" onClick={() => toggleGroup(perms, !all)}>
                          {all ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                        </button>
                      </div>
                      <div className="admin-check-grid">
                        {perms.map((p) => (
                          <CheckboxRow
                            key={p.id}
                            checked={draft.permissionIds.includes(p.id)}
                            onChange={(e) => togglePermission(p.id, e.target.checked)}
                            label={
                              <span>
                                <b dir="ltr">{p.code}</b>
                                {p.descriptionAr && <small>{p.descriptionAr}</small>}
                              </span>
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </FormDialog>
      )}

      {deleting && canManage && (
        <ConfirmDialog
          title="حذف الدور"
          message={`سيُحذف الدور «${deleting.nameAr}» نهائياً إذا لم يكن مستخدماً.`}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}