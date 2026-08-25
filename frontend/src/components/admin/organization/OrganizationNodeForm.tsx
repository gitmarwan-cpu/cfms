import { useState, type FormEvent } from 'react';
import type { OrganizationNodeDto, OrgUnitType } from '../../../api/adminApi';
import { createOrganizationNode, updateOrganizationNode } from '../../../api/adminApi';
import type { ApiClientError } from '../../../api/axiosClient';
import { FormDialog } from '../AdminUi';

interface OrganizationNodeFormProps {
  editingNode: OrganizationNodeDto | null;
  defaultParentId: number | null;
  allNodes: OrganizationNodeDto[];
  types: OrgUnitType[];
  onClose: () => void;
  onSaved: (node: OrganizationNodeDto) => void;
}

export default function OrganizationNodeForm({
  editingNode,
  defaultParentId,
  allNodes,
  types,
  onClose,
  onSaved,
}: OrganizationNodeFormProps) {
  const [name, setName] = useState(editingNode ? editingNode.name : '');
  const [shortName, setShortName] = useState(editingNode && editingNode.shortName ? editingNode.shortName : '');
  const [code, setCode] = useState(editingNode && editingNode.code ? editingNode.code : '');
  const [orgUnitTypeId, setOrgUnitTypeId] = useState<string>(
    editingNode && editingNode.orgUnitTypeId ? String(editingNode.orgUnitTypeId) : ''
  );
  const [parentId, setParentId] = useState<string>(
    editingNode
      ? editingNode.parentId ? String(editingNode.parentId) : ''
      : defaultParentId ? String(defaultParentId) : ''
  );
  const [phone, setPhone] = useState(editingNode && editingNode.phone ? editingNode.phone : '');
  const [email, setEmail] = useState(editingNode && editingNode.email ? editingNode.email : '');
  const [address, setAddress] = useState(editingNode && editingNode.address ? editingNode.address : '');
  const [isActive, setIsActive] = useState<boolean>(editingNode ? editingNode.isActive : true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Active organization classification types
  const activeTypes = types.filter((t) => t.isActive);

  // Exclude self and descendants from valid parents when editing to avoid cycle creation
  const isDescendant = (possibleAncestorId: number, targetId: number): boolean => {
    let curr = allNodes.find((n) => n.id === possibleAncestorId);
    const seen = new Set<number>();
    while (curr) {
      if (curr.id === targetId) return true;
      if (seen.has(curr.id)) break;
      const pid = curr.parentId;
      curr = pid ? allNodes.find((n) => n.id === pid) : undefined;
    }
    return false;
  };

  const validParents = allNodes.filter((n) => {
    if (!n.isActive) return false;
    if (!editingNode) return true;
    if (n.id === editingNode.id) return false;
    if (isDescendant(n.id, editingNode.id)) return false;
    return true;
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('اسم الوحدة التنظيمية مطلوب.');
      return;
    }

    const parsedTypeId = Number(orgUnitTypeId);
    if (!Number.isSafeInteger(parsedTypeId) || parsedTypeId <= 0) {
      setError('يرجى اختيار نوع الوحدة التنظيمية.');
      return;
    }

    const parsedParentId = parentId ? Number(parentId) : null;

    setSaving(true);
    try {
      if (editingNode) {
        const updated = await updateOrganizationNode(editingNode.id, {
          name: trimmedName,
          shortName: shortName.trim() || null,
          code: code.trim() || null,
          orgUnitTypeId: parsedTypeId,
          parentId: parsedParentId,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          isActive,
        });
        onSaved(updated);
      } else {
        const created = await createOrganizationNode({
          name: trimmedName,
          shortName: shortName.trim() || null,
          code: code.trim() || null,
          orgUnitTypeId: parsedTypeId,
          parentId: parsedParentId,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          isActive,
        });
        onSaved(created);
      }
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message || 'تعذر حفظ الوحدة التنظيمية. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      title={editingNode ? `تعديل وحدة: ${editingNode.name}` : 'إضافة وحدة تنظيمية جديدة'}
      onClose={onClose}
      onSubmit={submit}
      saving={saving}
      error={error}
      submitLabel={editingNode ? 'حفظ التغييرات' : 'إنشاء الوحدة'}
    >
      <div className="admin-form-grid">
        <label className="field admin-field--full">
          اسم الوحدة التنظيمية *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: الإدارة العامة، فرع عدن، قسم الشكاوى…"
            required
            maxLength={150}
          />
        </label>

        <label className="field">
          الاسم المختصر (اختياري)
          <input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="مثال: ADE, HR, IT"
            maxLength={50}
          />
        </label>

        <label className="field">
          الرمز المرجعي (اختياري)
          <input
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="مثال: HQ-001"
            maxLength={50}
          />
        </label>

        <label className="field">
          نوع الوحدة التنظيمية *
          <select
            value={orgUnitTypeId}
            onChange={(e) => setOrgUnitTypeId(e.target.value)}
            required
          >
            <option value="">اختر النوع…</option>
            {activeTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.nameAr}
                {type.nameEn ? ` (${type.nameEn})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          الوحدة التنظيمية الأم
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">(بدون أم — وحدة جذرية)</option>
            {validParents.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
                {node.code ? ` (${node.code})` : ''}
              </option>
            ))}
          </select>
          <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
            تحدد الموضع في الشجرة الهرمية
          </small>
        </label>

        <label className="field">
          رقم الهاتف
          <input
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+967-..."
          />
        </label>

        <label className="field">
          البريد الإلكتروني
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="unit@organization.org"
          />
        </label>

        <label className="field admin-field--full">
          العنوان
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="الشارع، الحي، المبنى…"
          />
        </label>

        {editingNode && (
          <label className="admin-check admin-field--full" style={{ marginTop: '8px' }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>وحدة مفعّلة ونشطة</span>
          </label>
        )}
      </div>
    </FormDialog>
  );
}
