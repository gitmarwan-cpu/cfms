import { useEffect, useState, type FormEvent } from 'react';
import {
  createReferenceItem,
  deactivateReferenceItem,
  fetchAdminReferenceItems,
  fetchReferenceLists,
  updateReferenceItem,
  type ReferenceItem,
  type ReferenceList,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { ConfirmDialog, DataState, FormDialog } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { CheckboxRow } from '../../components/ui/Checkbox';
import { formatDate } from '../../utils/dateTime';

type Draft = {
  code: string;
  labelAr: string;
  labelEn: string;
  sortOrder: string;
  isActive: boolean;
  isDefault: boolean;
};

const emptyDraft: Draft = { code: '', labelAr: '', labelEn: '', sortOrder: '0', isActive: true, isDefault: false };

export default function ReferenceDataPage() {
  const { user, hasPermission, currentOrganizationId } = useAuth();
  const organizationId = currentOrganizationId;
  const canManage = organizationId !== null && organizationId !== undefined && hasPermission('reference_data.manage', organizationId);
  const [lists, setLists] = useState<ReferenceList[]>([]);
  const [key, setKey] = useState('');
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ReferenceItem | null | undefined>();
  const [deleting, setDeleting] = useState<ReferenceItem | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadLists = () => {
    setLoading(true);
    setError('');
    fetchReferenceLists()
      .then((data) => { setLists(data); setKey((current) => current || data[0]?.key || ''); })
      .catch((err: ApiClientError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadItems = () => {
    if (!key) { setItems([]); return; }
    setLoading(true);
    setError('');
    fetchAdminReferenceItems(key)
      .then(setItems)
      .catch((err: ApiClientError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadLists, []);
  useEffect(loadItems, [key]);

  const open = (item?: ReferenceItem) => {
    if (!canManage) return;
    setEditing(item ?? null);
    setDraft(item ? {
      code: item.code,
      labelAr: item.labelAr,
      labelEn: item.labelEn || '',
      sortOrder: String(item.sortOrder ?? 0),
      isActive: item.isActive ?? false,
      isDefault: item.isDefault ?? false,
    } : emptyDraft);
    setFormError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      labelAr: draft.labelAr.trim(),
      labelEn: draft.labelEn.trim() || null,
      sortOrder: Number(draft.sortOrder),
      isActive: draft.isActive,
      isDefault: draft.isDefault,
      ...(editing ? {} : { code: draft.code.trim() }),
    };
    try {
      if (editing) await updateReferenceItem(key, editing.id, payload);
      else await createReferenceItem(key, payload);
      setEditing(undefined);
      loadItems();
    } catch (err) {
      setFormError((err as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!deleting) return;
    try {
      await deactivateReferenceItem(key, deleting.id);
      setDeleting(null);
      loadItems();
    } catch (err) {
      setError((err as ApiClientError).message);
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader title="البيانات المرجعية" description="إدارة عناصر القوائم المرجعية ضمن نطاق المؤسسة." actions={canManage && <button className="btn btn-primary" onClick={() => open()} disabled={!key} type="button">إضافة عنصر</button>} />
      {!canManage && <div className="admin-readonly-note" role="status">يمكنك استعراض البيانات المرجعية فقط؛ لا تملك صلاحية تعديلها.</div>}
      <div className="card admin-filter-bar">
        <label className="field" htmlFor="reference-list">القائمة<select id="reference-list" value={key} onChange={(event) => setKey(event.target.value)}>{lists.map((list) => <option key={list.id} value={list.key}>{list.nameAr || list.key}</option>)}</select></label>
      </div>
      <DataState loading={loading} error={error} empty={!items.length} onRetry={key ? loadItems : loadLists}>
        <div className="card admin-table-card"><div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>التسمية</th><th>الرمز</th><th>الترتيب</th><th>الحالة</th><th>تاريخ الإنشاء</th><th>آخر تحديث</th>{canManage && <th>إجراء</th>}</tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}>
            <td>{item.labelAr}</td><td dir="ltr">{item.code}</td><td>{item.sortOrder}</td>
            <td><StatusBadge tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'نشط' : 'معطل'}</StatusBadge></td>
            <td>{formatDate(item.createdAt)}</td><td>{formatDate(item.updatedAt)}</td>
            {canManage && <td className="admin-actions"><button className="btn btn-outline" onClick={() => open(item)} type="button">تعديل</button>{item.isActive && <button className="admin-text-button danger" onClick={() => setDeleting(item)} type="button">إلغاء التفعيل</button>}</td>}
          </tr>)}</tbody>
        </table></div></div>
      </DataState>
      {editing !== undefined && canManage && <FormDialog title={editing ? 'تعديل عنصر' : 'إضافة عنصر'} onClose={() => setEditing(undefined)} onSubmit={submit} saving={saving} error={formError}>
        <div className="admin-form-grid">
          {!editing && <label className="field">الرمز<input dir="ltr" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} required /></label>}
          <label className="field">التسمية العربية<input value={draft.labelAr} onChange={(event) => setDraft({ ...draft, labelAr: event.target.value })} required /></label>
          <label className="field">التسمية الإنجليزية<input dir="ltr" value={draft.labelEn} onChange={(event) => setDraft({ ...draft, labelEn: event.target.value })} /></label>
          <label className="field">الترتيب<input type="number" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} /></label>
          <CheckboxRow label="نشط" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
          <CheckboxRow label="افتراضي" checked={draft.isDefault} onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })} />
        </div>
      </FormDialog>}
      {deleting && canManage && <ConfirmDialog title="إلغاء تفعيل العنصر" message={`سيتم إلغاء تفعيل «${deleting.labelAr}».`} onClose={() => setDeleting(null)} onConfirm={deactivate} />}
    </>
  );
}
