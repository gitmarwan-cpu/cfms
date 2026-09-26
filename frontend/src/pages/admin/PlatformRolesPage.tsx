import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  fetchPlatformRoles,
  fetchPlatformPermissions,
  createPlatformRole,
  updatePlatformRole,
  type PlatformRole,
  type PlatformPermission,
  type CreatePlatformRoleInput,
  type UpdatePlatformRoleInput,
} from '../../api/platformApi';
import type { ApiClientError } from '../../api/axiosClient';
import { ConfirmDialog, DataState, FormDialog } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import { CheckboxRow } from '../../components/ui/Checkbox';
import { Lock, Plus, Shield } from 'lucide-react';

// Human-readable Arabic label for the platform scope value.
const SCOPE_LABELS: Record<string, string> = {
  platform: 'منصة',
};
const scopeLabel = (scope: string) => SCOPE_LABELS[scope] ?? scope;

// Human-readable Arabic labels for platform permission module names.
const PLATFORM_MODULE_LABELS: Record<string, string> = {
  platform: 'المنصة',
};
const platformModuleLabel = (module: string) =>
  PLATFORM_MODULE_LABELS[module] ?? module ?? 'عام';

type Draft = {
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  isActive: boolean;
  permissionIds: number[];
};

const emptyDraft: Draft = {
  code: '',
  nameAr: '',
  nameEn: '',
  description: '',
  isActive: true,
  permissionIds: [],
};

function roleToDraft(role: PlatformRole): Draft {
  return {
    code: role.code,
    nameAr: role.nameAr,
    nameEn: role.nameEn ?? '',
    description: role.description ?? '',
    isActive: role.isActive,
    permissionIds: role.permissions.map((p) => p.id),
  };
}

export default function PlatformRolesPage() {
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // editing === undefined  → dialog closed
  // editing === null       → creating a new role
  // editing === PlatformRole → editing existing role
  const [editing, setEditing] = useState<PlatformRole | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Confirm toggle-activation dialog
  const [toggling, setToggling] = useState<PlatformRole | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([fetchPlatformRoles(), fetchPlatformPermissions()])
      .then(([nextRoles, nextPermissions]) => {
        setRoles(nextRoles);
        setPermissions(nextPermissions);
      })
      .catch((e: ApiClientError) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Group platform permissions by module for the form UI.
  const permGroups = useMemo(() => {
    const map = new Map<string, PlatformPermission[]>();
    for (const p of permissions) {
      const key = p.module ?? 'platform';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].sort((a, b) =>
      platformModuleLabel(a[0]).localeCompare(platformModuleLabel(b[0]), 'ar')
    );
  }, [permissions]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setFormError('');
  };

  const openEdit = (role: PlatformRole) => {
    setEditing(role);
    setDraft(roleToDraft(role));
    setFormError('');
  };

  const closeDialog = () => setEditing(undefined);

  const togglePermission = (id: number, checked: boolean) =>
    setDraft((prev) => ({
      ...prev,
      permissionIds: checked
        ? [...prev.permissionIds, id]
        : prev.permissionIds.filter((x) => x !== id),
    }));

  const toggleGroup = (group: PlatformPermission[], checked: boolean) =>
    setDraft((prev) => {
      const ids = new Set(prev.permissionIds);
      for (const p of group) {
        if (checked) ids.add(p.id);
        else ids.delete(p.id);
      }
      return { ...prev, permissionIds: [...ids] };
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!draft.nameAr.trim()) {
      setFormError('الاسم بالعربية مطلوب.');
      return;
    }
    if (editing === null && !draft.code.trim()) {
      setFormError('الرمز مطلوب عند إنشاء دور جديد.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        // Editing existing — never send code (backend does not support code updates).
        // System roles cannot have permissionIds sent; guard handled by conditional below.
        const payload: UpdatePlatformRoleInput = {
          nameAr: draft.nameAr,
          nameEn: draft.nameEn || null,
          description: draft.description || null,
          isActive: draft.isActive,
          // Do not include permissionIds for system roles — backend would 403.
          ...(editing.isSystem ? {} : { permissionIds: draft.permissionIds }),
        };
        await updatePlatformRole(editing.id, payload);
      } else {
        // Creating new
        const payload: CreatePlatformRoleInput = {
          code: draft.code,
          nameAr: draft.nameAr,
          nameEn: draft.nameEn || null,
          description: draft.description || null,
          permissionIds: draft.permissionIds,
        };
        await createPlatformRole(payload);
      }
      closeDialog();
      load();
    } catch (e) {
      setFormError((e as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  // Activation/deactivation via the same PUT endpoint.
  const confirmToggle = async () => {
    if (!toggling) return;
    setToggleBusy(true);
    try {
      await updatePlatformRole(toggling.id, { isActive: !toggling.isActive });
      setToggling(null);
      load();
    } catch (e) {
      setError((e as ApiClientError).message);
      setToggling(null);
    } finally {
      setToggleBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="أدوار المنصة"
        description="إدارة أدوار المنصة وصلاحياتها. الأدوار النظامية محمية ولا يمكن تعطيلها أو تعديل صلاحياتها."
        actions={
          <button className="btn btn-primary" onClick={openCreate} type="button">
            <Plus size={16} aria-hidden="true" /> إضافة دور
          </button>
        }
      />

      <DataState loading={loading} error={error} empty={!roles.length} onRetry={load}>
        <div className="card admin-table-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الدور</th>
                  <th>الرمز</th>
                  <th>النطاق</th>
                  <th>الصلاحيات</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <span className="role-name">
                        <strong>{role.nameAr}</strong>
                        {role.isSystem && (
                          <span
                            className="role-badge role-badge--system"
                            title="دور نظامي محمي — لا يمكن تعطيله أو تعديل صلاحياته"
                          >
                            <Lock size={12} aria-hidden="true" /> نظامي
                          </span>
                        )}
                      </span>
                      {role.description && (
                        <small className="admin-muted role-desc">{role.description}</small>
                      )}
                    </td>
                    <td className="role-code" dir="ltr">
                      {role.code}
                    </td>
                    <td>
                      <span className="role-scope">{scopeLabel(role.scope)}</span>
                    </td>
                    <td>
                      <span className="role-perm-count">
                        <Shield size={13} aria-hidden="true" />
                        {role.permissions.length}
                      </span>
                    </td>
                    <td>
                      <StatusBadge tone={role.isActive ? 'success' : 'neutral'}>
                        {role.isActive ? 'نشط' : 'معطّل'}
                      </StatusBadge>
                    </td>
                    <td className="admin-actions">
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => openEdit(role)}
                      >
                        تعديل
                      </button>
                      {/* Deactivation/activation — blocked for system roles */}
                      {!role.isSystem && (
                        <button
                          className={
                            role.isActive
                              ? 'admin-text-button danger'
                              : 'admin-text-button'
                          }
                          type="button"
                          onClick={() => setToggling(role)}
                        >
                          {role.isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DataState>

      {/* ── Create / Edit dialog ──────────────────────────────────────── */}
      {editing !== undefined && (
        <FormDialog
          title={editing ? `تعديل الدور: ${editing.nameAr}` : 'إضافة دور منصة'}
          onClose={closeDialog}
          onSubmit={submit}
          saving={saving}
          error={formError}
        >
          <div className="admin-form-grid">
            {/* Code — only on create; not editable after creation */}
            {editing === null && (
              <label className="field">
                الرمز
                <input
                  dir="ltr"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  required
                  pattern="[a-z0-9_]+"
                  placeholder="مثال: platform_viewer"
                />
              </label>
            )}

            <label className="field">
              الاسم بالعربية
              <input
                value={draft.nameAr}
                onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
                required
              />
            </label>

            <label className="field">
              الاسم بالإنجليزية
              <input
                dir="ltr"
                value={draft.nameEn}
                onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
              />
            </label>

            <label className="field admin-field--full">
              الوصف
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            {/* Active toggle — hidden for system roles (backend forbids deactivation) */}
            {editing && !editing.isSystem && (
              <label className="field admin-field--full">
                <span>الحالة</span>
                <CheckboxRow
                  label="نشط"
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
              </label>
            )}

            {/* Permission selector — hidden for system roles (backend forbids modification) */}
            {!(editing && editing.isSystem) && (
              <fieldset className="admin-field--full role-perm-fieldset">
                <legend>صلاحيات المنصة</legend>
                {permGroups.length === 0 ? (
                  <p className="admin-muted">لا توجد صلاحيات متاحة.</p>
                ) : (
                  <div className="role-perm-groups">
                    {permGroups.map(([moduleKey, perms]) => {
                      const allSelected = perms.every((p) =>
                        draft.permissionIds.includes(p.id)
                      );
                      return (
                        <div className="role-perm-group" key={moduleKey}>
                          <div className="role-perm-group-head">
                            <span className="role-perm-group-title">
                              {platformModuleLabel(moduleKey)}
                            </span>
                            <button
                              type="button"
                              className="admin-text-button role-perm-toggle"
                              onClick={() => toggleGroup(perms, !allSelected)}
                            >
                              {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
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
                )}
              </fieldset>
            )}

            {/* Read-only notice for system roles */}
            {editing && editing.isSystem && (
              <div className="admin-field--full">
                <p className="admin-muted" role="note">
                  <Lock size={13} aria-hidden="true" /> الأدوار النظامية محمية — لا يمكن تعديل
                  صلاحياتها أو تعطيلها. يمكنك فقط تعديل الاسم والوصف.
                </p>
              </div>
            )}
          </div>
        </FormDialog>
      )}

      {/* ── Activate / Deactivate confirm ─────────────────────────────── */}
      {toggling && (
        <ConfirmDialog
          title={toggling.isActive ? 'تعطيل الدور' : 'تفعيل الدور'}
          message={
            toggling.isActive
              ? `سيُعطَّل الدور «${toggling.nameAr}». لن يتمكن مستخدمو هذا الدور من ممارسة صلاحياته حتى إعادة تفعيله.`
              : `سيُعاد تفعيل الدور «${toggling.nameAr}».`
          }
          onClose={() => setToggling(null)}
          onConfirm={confirmToggle}
          busy={toggleBusy}
        />
      )}
    </>
  );
}
