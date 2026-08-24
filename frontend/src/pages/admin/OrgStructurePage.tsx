import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { createOrgUnit, deactivateOrgUnit, fetchOrgUnits, fetchOrgUnitTypes, updateOrgUnit, type OrgUnit, type OrgUnitType } from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { ConfirmDialog, DataState, FormDialog, PageHeader } from '../../components/admin/AdminUi';
import OrganizationTree from '../../components/admin/OrganizationTree';
import { fromOrgUnitDto } from '../../types/organization';
import { buildOrgTree } from '../../utils/organizationTree';

type Draft = { name: string; code: string; orgUnitTypeId: string; parentId: string; phone: string; email: string; isActive: boolean };
const empty: Draft = { name: '', code: '', orgUnitTypeId: '', parentId: '', phone: '', email: '', isActive: true };

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
    Promise.all([fetchOrgUnits(), fetchOrgUnitTypes()])
      .then(([u, t]) => { setUnits(u); setTypes(t); })
      .catch((e: ApiClientError) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const open = (unit?: OrgUnit) => {
    setEditing(unit ?? null);
    setFormError('');
    setDraft(unit ? {
      name: unit.name,
      code: unit.code || '',
      orgUnitTypeId: String(unit.orgUnitTypeId),
      parentId: unit.parentId ? String(unit.parentId) : '',
      phone: '',
      email: '',
      isActive: unit.isActive,
    } : empty);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const p = {
      name: draft.name,
      code: draft.code || undefined,
      orgUnitTypeId: Number(draft.orgUnitTypeId),
      parentId: draft.parentId ? Number(draft.parentId) : null,
      phone: draft.phone || undefined,
      email: draft.email || undefined,
      isActive: draft.isActive,
    };
    try {
      if (editing) await updateOrgUnit(editing.id, p);
      else await createOrgUnit(p);
      setEditing(undefined);
      load();
    } catch (err) {
      setFormError((err as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  const treeNodes = useMemo(() => {
    const nodes = units.map(fromOrgUnitDto);
    return buildOrgTree(nodes);
  }, [units]);

  return (
    <>
      <PageHeader
        title="الهيكل التنظيمي"
        description="الوحدات التنظيمية وعلاقاتها الهرمية ضمن المؤسسة."
        actions={<button className="btn btn-primary" onClick={() => open()}>إضافة وحدة</button>}
      />
      <DataState loading={loading} error={error} empty={!units.length} onRetry={load}>
        <OrganizationTree
          nodes={treeNodes}
          onEdit={(node) => { const original = units.find(u => u.id === node.id); if (original) open(original); }}
          onDeactivate={(node) => { const original = units.find(u => u.id === node.id); if (original) setDeleting(original); }}
        />
      </DataState>

      {editing !== undefined && (
        <FormDialog
          title={editing ? 'تعديل وحدة' : 'إضافة وحدة'}
          onClose={() => setEditing(undefined)}
          onSubmit={submit}
          saving={saving}
          error={formError}
        >
          <div className="admin-form-grid">
            <label className="field">
              الاسم
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required />
            </label>
            <label className="field">
              الرمز
              <input dir="ltr" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} />
            </label>
            <label className="field">
              نوع الوحدة
              <select value={draft.orgUnitTypeId} onChange={e => setDraft({ ...draft, orgUnitTypeId: e.target.value })} required>
                <option value="">اختر النوع</option>
                {types.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.nameAr}</option>
                ))}
              </select>
            </label>
            <label className="field">
              الوحدة الأم
              <select value={draft.parentId} onChange={e => setDraft({ ...draft, parentId: e.target.value })}>
                <option value="">بدون أم</option>
                {units.filter(u => u.id !== editing?.id && u.isActive).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              الهاتف
              <input dir="ltr" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
            </label>
            <label className="field">
              البريد الإلكتروني
              <input type="email" dir="ltr" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
            </label>
            <label className="admin-check">
              <input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} />
              نشط
            </label>
          </div>
        </FormDialog>
      )}

      {deleting && (
        <ConfirmDialog
          title="تأكيد إلغاء التنشيط"
          message={`هل أنت متأكد من إلغاء تنشيط "${deleting.name}"؟`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await deactivateOrgUnit(deleting.id);
              setDeleting(null);
              load();
            } catch (e) {
              setError((e as ApiClientError).message);
              setDeleting(null);
            }
          }}
        />
      )}
    </>
  );
}