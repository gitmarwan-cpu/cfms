import { useEffect, useState, type FormEvent } from 'react';
import {
  createSlaRule,
  evaluateSla,
  fetchAdminReferenceItems,
  fetchSlaRules,
  updateSlaRule,
  type ReferenceItem,
  type SlaRule,
} from '../../api/adminApi';
import { CheckboxRow } from '../../components/ui/Checkbox';
import type { ApiClientError } from '../../api/axiosClient';
import { CheckCircle2 } from 'lucide-react';
import { DataState, FormDialog } from '../../components/admin/AdminUi';
import { PageHeader } from '../../components/patterns/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/dateTime';

type SensitiveFilter = '' | 'true' | 'false';
type Draft = {
  name: string;
  complaintType: '' | 'complaint' | 'proposal';
  categoryItemId: string;
  priorityItemId: string;
  isSensitive: SensitiveFilter;
  firstResponseHours: string;
  resolutionHours: string;
  escalationIntervalHours: string;
  maxEscalationLevel: string;
  isActive: boolean;
};

const emptyDraft: Draft = {
  name: '', complaintType: '', categoryItemId: '', priorityItemId: '', isSensitive: '',
  firstResponseHours: '24', resolutionHours: '72', escalationIntervalHours: '24',
  maxEscalationLevel: '3', isActive: true,
};

const criteriaLabel = (item: ReferenceItem | undefined, id: number | null) => item?.labelAr || (id ? `معرّف #${id}` : 'كل القيم');

export default function SlaPage() {
  const { user, hasPermission, currentOrganizationId } = useAuth();
  const organizationId = currentOrganizationId;
  const canManage = organizationId !== null && organizationId !== undefined && hasPermission('organization.manage', organizationId);
  const canEvaluate = organizationId !== null && organizationId !== undefined && hasPermission('complaints.view_all', organizationId);
  const canViewReference = organizationId !== null && organizationId !== undefined && hasPermission('reference_data.view', organizationId);
  const [items, setItems] = useState<SlaRule[]>([]);
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [priorities, setPriorities] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [criteriaError, setCriteriaError] = useState('');
  const [editing, setEditing] = useState<SlaRule | null | undefined>();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [formError, setFormError] = useState('');
  const [evaluation, setEvaluation] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetchSlaRules()
      .then(setItems)
      .catch((err: ApiClientError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!canViewReference) return;
    setCriteriaError('');
    Promise.all([fetchAdminReferenceItems('complaint_category'), fetchAdminReferenceItems('priority')])
      .then(([nextCategories, nextPriorities]) => {
        setCategories(nextCategories.filter((item) => item.isActive !== false));
        setPriorities(nextPriorities.filter((item) => item.isActive !== false));
      })
      .catch((err: ApiClientError) => setCriteriaError(err.message || 'تعذر تحميل معايير المطابقة.'));
  }, [canViewReference]);

  const open = (rule?: SlaRule) => {
    if (!canManage) return;
    setEditing(rule ?? null);
    setFormError('');
    setDraft(rule ? {
      name: rule.name,
      complaintType: rule.complaintType || '',
      categoryItemId: rule.categoryItemId ? String(rule.categoryItemId) : '',
      priorityItemId: rule.priorityItemId ? String(rule.priorityItemId) : '',
      isSensitive: rule.isSensitive === null ? '' : String(rule.isSensitive) as SensitiveFilter,
      firstResponseHours: String(rule.firstResponseHours),
      resolutionHours: String(rule.resolutionHours),
      escalationIntervalHours: String(rule.escalationIntervalHours),
      maxEscalationLevel: String(rule.maxEscalationLevel),
      isActive: rule.isActive,
    } : emptyDraft);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      complaintType: draft.complaintType || null,
      categoryItemId: draft.categoryItemId ? Number(draft.categoryItemId) : null,
      priorityItemId: draft.priorityItemId ? Number(draft.priorityItemId) : null,
      isSensitive: draft.isSensitive === '' ? null : draft.isSensitive === 'true',
      firstResponseHours: Number(draft.firstResponseHours),
      resolutionHours: Number(draft.resolutionHours),
      escalationIntervalHours: Number(draft.escalationIntervalHours),
      maxEscalationLevel: Number(draft.maxEscalationLevel),
      isActive: draft.isActive,
    };
    try {
      if (editing) await updateSlaRule(editing.id, payload);
      else await createSlaRule(payload);
      setEditing(undefined);
      load();
    } catch (err) {
      setFormError((err as ApiClientError).message);
    } finally {
      setSaving(false);
    }
  };

  const runEvaluation = async () => {
    if (!canEvaluate) return;
    setEvaluating(true);
    setEvaluation('');
    try {
      const result = await evaluateSla();
      setEvaluation(`تم تقييم ${result.evaluated} طلب؛ المتأخر: ${result.overdue}، والمصعّد: ${result.escalated}.`);
    } catch (err) {
      setError((err as ApiClientError).message);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="قواعد مهلة المعالجة (SLA)"
        description="قواعد زمن الاستجابة والحل والتصعيد الفعلية."
        actions={<span className="admin-actions">{canEvaluate && <button className="btn btn-outline" onClick={runEvaluation} disabled={evaluating} type="button">{evaluating ? 'جارٍ التقييم…' : 'تقييم SLA'}</button>}{canManage && <button className="btn btn-primary" onClick={() => open()} type="button">إضافة قاعدة</button>}</span>}
      />
      {!canManage && <div className="admin-readonly-note" role="status">يمكنك استعراض قواعد SLA فقط؛ لا تملك صلاحية تعديلها.</div>}
      {canManage && !canViewReference && <div className="admin-readonly-note" role="status">لا يمكن اختيار التصنيف أو الأولوية دون صلاحية عرض البيانات المرجعية؛ ستظل المعايير الحالية محفوظة كما هي.</div>}
      {criteriaError && <div className="admin-readonly-note" role="status">تعذر تحميل أسماء التصنيفات والأولويات؛ ستظهر المعايير الحالية بالمعرّف فقط.</div>}
      {evaluation && <div className="nla-notice" role="status"><CheckCircle2 size={16} aria-hidden="true" /><span>{evaluation}</span></div>}

      <DataState loading={loading} error={error} empty={!items.length} onRetry={load}>
        <div className="card admin-table-card"><div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>القاعدة</th><th>النوع</th><th>التصنيف</th><th>الأولوية</th><th>الحساسية</th><th>استجابة أولى</th><th>الحل</th><th>التصعيد</th><th>الحالة</th>{canManage && <th>إجراء</th>}</tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.complaintType === 'complaint' ? 'شكوى' : item.complaintType === 'proposal' ? 'مقترح' : 'كل الأنواع'}</td>
            <td>{criteriaLabel(categories.find((option) => option.id === item.categoryItemId), item.categoryItemId)}</td>
            <td>{criteriaLabel(priorities.find((option) => option.id === item.priorityItemId), item.priorityItemId)}</td>
            <td>{item.isSensitive === null ? 'كل الطلبات' : item.isSensitive ? 'حساس' : 'غير حساس'}</td>
            <td>{item.firstResponseHours} ساعة</td><td>{item.resolutionHours} ساعة</td><td>{item.escalationIntervalHours} ساعة</td>
            <td><StatusBadge tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'نشطة' : 'معطلة'}</StatusBadge></td>
            {canManage && <td><button className="btn btn-outline" onClick={() => open(item)} type="button">تعديل</button></td>}
          </tr>)}</tbody>
        </table></div></div>
      </DataState>

      {editing !== undefined && canManage && <FormDialog title={editing ? 'تعديل قاعدة SLA' : 'إضافة قاعدة SLA'} onClose={() => setEditing(undefined)} onSubmit={submit} saving={saving} error={formError}>
        <div className="admin-form-grid">
          <label className="field">اسم القاعدة<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
          <label className="field">نوع الطلب<select value={draft.complaintType} onChange={(event) => setDraft({ ...draft, complaintType: event.target.value as Draft['complaintType'] })}><option value="">كل الأنواع</option><option value="complaint">شكوى</option><option value="proposal">مقترح</option></select></label>
          <label className="field">التصنيف<select value={draft.categoryItemId} onChange={(event) => setDraft({ ...draft, categoryItemId: event.target.value })} disabled={!canViewReference}><option value="">كل التصنيفات</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.labelAr}</option>)}</select></label>
          <label className="field">الأولوية<select value={draft.priorityItemId} onChange={(event) => setDraft({ ...draft, priorityItemId: event.target.value })} disabled={!canViewReference}><option value="">كل الأولويات</option>{priorities.map((item) => <option key={item.id} value={item.id}>{item.labelAr}</option>)}</select></label>
          <label className="field">الحساسية<select value={draft.isSensitive} onChange={(event) => setDraft({ ...draft, isSensitive: event.target.value as SensitiveFilter })}><option value="">كل الطلبات</option><option value="true">حساس</option><option value="false">غير حساس</option></select></label>
          <label className="field">ساعات الاستجابة الأولى<input type="number" min="1" max="8760" value={draft.firstResponseHours} onChange={(event) => setDraft({ ...draft, firstResponseHours: event.target.value })} required /></label>
          <label className="field">ساعات الحل<input type="number" min="1" max="8760" value={draft.resolutionHours} onChange={(event) => setDraft({ ...draft, resolutionHours: event.target.value })} required /></label>
          <label className="field">فاصل التصعيد<input type="number" min="1" max="8760" value={draft.escalationIntervalHours} onChange={(event) => setDraft({ ...draft, escalationIntervalHours: event.target.value })} required /></label>
          <label className="field">الحد الأقصى للتصعيد<input type="number" min="1" max="10" value={draft.maxEscalationLevel} onChange={(event) => setDraft({ ...draft, maxEscalationLevel: event.target.value })} required /></label>
          <CheckboxRow label="نشطة" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
        </div>
      </FormDialog>}
    </>
  );
}
