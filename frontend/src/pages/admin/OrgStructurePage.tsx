import { useEffect, useState, type FormEvent } from 'react';
import {
  createOrgUnit,
  deactivateOrgUnit,
  fetchOrgUnits,
  fetchOrgUnitTypes,
  updateOrgUnit,
  type OrgUnit,
  type OrgUnitType,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { ConfirmDialog, DataState, FormDialog, PageHeader } from '../../components/admin/AdminUi';
import { buildOrgTree, type OrgTreeNode } from '../../utils/orgHierarchy';
import { OrgUnitTree } from '../../components/admin/OrgUnitTree';

type Draft = {
  name: string;
  code: string;
  orgUnitTypeId: string;
  parentId: string;
  phone: string;
  email: string;
  isActive: boolean;
};
const empty: Draft = {
  name: '',
  code: '',
  orgUnitTypeId: '',
  parentId: '',
  phone: '',
  email: '',
  isActive: true,
};

export default function OrgStructurePage() {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [types, setTypes] = useState<OrgUnitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<OrgUnit | null | undefined>();
  const [deleting, setDeleting] = useState<OrgUnit | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([fetchOrgUnits(), fetchOrgUnitTypes()])
      .then(([u, t]) => { setUnits(u); setTypes(t); })
      .catch((e: ApiClientError) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const open = (unit?: OrgUnit) => {
    setEditing(unit ?? null);
    setFormError('');
    setDraft(
      unit
        ? {
            name: unit.name,
            code: unit.code || '',
            orgUnitTypeId: String(unit.orgUnitTypeId),
            parentId: unit.parentId ? String(unit.parentId) : '',
            phone: '',
            email: '',
            isActive: unit.isActive,
          }
        : empty
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      name: draft.name,
      code: draft.code || undefined,
      orgUnitTypeId: Number(draft.orgUnitTypeId),
      parentId: draft.parentId ? Number(draft.parentId) : null,
      phone: draft.phone || undefined,
      email: draft.email || undefined,
      isActive: draft.isActive,
    };
    try {
      if (editing) {
        await updateOrgUnit(editing.id, payload);
      } else {
        await createOrgUnit(payload);
      }
      setEditing(undefined);
      load();
    } catch (err) {
      setFormError((err as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deactivateOrgUnit(deleting.id);
      setDeleting(null);
      load();
    } catch (err) {
      setError((err as ApiClientError).message);
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  };

  const tree: OrgTreeNode[] = buildOrgTree(units);

  return (
    <>
      <PageHeader
        title="الهيكل التنظيمي"
        description="الوحدات التنظيمية وعلاقاتها الهرمية ضمن المؤسسة."
        actions={
          <button className="btn btn-primary" onClick={() => open()}>
            إضافة وحدة
          </button>
        }
      />

      <DataState loading={loading} error={error} empty={!units.length} onRetry={load}>
        <OrgUnitTree nodes={tree} onEdit={(unit) => open(unit)} onDeactivate={(unit) => setDeleting(unit)} />
      </DataState>

      {editing !== undefined && (
        <FormDialog
          title={editing ? 'تعديل الوحدة التنظيمية' : 'إضافة وحدة تنظيمية جديدة'}
          onClose={() => setEditing(undefined)}
          onSubmit={submit}
          saving={saving}
          error={formError}
          submitLabel={editing ? 'حفظ التعديلات' : 'إضافة'}
        >
          <div className="field">
            <label htmlFor="orgName">الاسم</label>
            <input
              id="orgName"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="orgCode">الرمز</label>
            <input
              id="orgCode"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="orgType">نوع الوحدة</label>
            <select
              id="orgType"
              value={draft.orgUnitTypeId}
              onChange={(e) => setDraft({ ...draft, orgUnitTypeId: e.target.value })}
              required
            >
              <option value="">اختر النوع</option>
              {types.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="orgParent">الوحدة الأم</label>
            <select
              id="orgParent"
              value={draft.parentId}
              onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}
            >
              <option value="">بدون (وحدة جذرية)</option>
              {units
                .filter((u) => u.isActive && (editing ? u.id !== editing.id : true))
                .map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="orgActive">الحالة</label>
            <select
              id="orgActive"
              value={String(draft.isActive)}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.value === 'true' })}
            >
              <option value="true">نشط</option>
              <option value="false">معطّل</option>
            </select>
          </div>
        </FormDialog>
      )}

      {deleting && (
        <ConfirmDialog
          title="تعطيل الوحدة التنظيمية"
          message={`سيتم تعطيل الوحدة "${deleting.name}". هل أنت متأكد؟`}
          confirmLabel="تعطيل"
          onClose={() => setDeleting(null)}
          onConfirm={handleDeactivate}
          busy={saving}
        />
      )}
    </>
  );
}