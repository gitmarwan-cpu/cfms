import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormDialog } from '../AdminUi';
import { registerUser, type ManagedUser, type RegisterUserInput } from '../../../api/usersApi';
import { fetchOrganizationNodes, type OrganizationNodeDto, type Role } from '../../../api/adminApi';
import type { ApiClientError } from '../../../api/axiosClient';
import { useAuth } from '../../../context/AuthContext';

interface UserCreateDialogProps {
  /** Roles visible in the active organization (used for the initial roleCode). */
  roles: Role[];
  onClose: () => void;
  onCreated: (user: ManagedUser) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Modern create-user dialog backed by POST /auth/register (users.manage). */
export default function UserCreateDialog({ roles, onClose, onCreated }: UserCreateDialogProps) {
  const { user, currentOrganizationId } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Organization Nodes State ─────────────────────────────────────────────
  const [nodes, setNodes] = useState<OrganizationNodeDto[]>([]);
  const [nodesLoading, setNodesLoading] = useState(true);
  const [nodesError, setNodesError] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [defaultNodeId, setDefaultNodeId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchOrganizationNodes()
      .then((data) => {
        if (mounted) {
          setNodes(data);
          setNodesLoading(false);
        }
      })
      .catch((err: ApiClientError) => {
        if (mounted) {
          setNodesError(err.message || 'تعذر تحميل الوحدات التنظيمية.');
          setNodesLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Determine authorized nodes based on creator permissions in the current organization
  const authorizedNodes = useMemo(() => {
    if (!user?.permissions || currentOrganizationId === null) return [];
    const managePerms = user.permissions.filter(
      (p) => p.code === 'users.manage' && p.organizationId === currentOrganizationId
    );
    const isTenantWide = managePerms.some((p) => p.orgUnitId === null);
    const allowedNodeIds = new Set(
      managePerms.map((p) => p.orgUnitId).filter((id): id is number => typeof id === 'number')
    );
    return nodes.filter((n) => n.isActive && (isTenantWide || allowedNodeIds.has(n.id)));
  }, [nodes, user?.permissions, currentOrganizationId]);

  const toggleNode = (nodeId: number) => {
    setSelectedNodeIds((prev) => {
      const isSelected = prev.includes(nodeId);
      const updated = isSelected ? prev.filter((id) => id !== nodeId) : [...prev, nodeId];

      // Auto-establish valid default when nodes are selected
      if (updated.length === 0) {
        setDefaultNodeId(null);
      } else if (defaultNodeId === null || !updated.includes(defaultNodeId)) {
        setDefaultNodeId(updated[0] ?? null);
      }

      return updated;
    });
  };

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

    if (selectedNodeIds.length > 0 && defaultNodeId === null) {
      setError('يجب تحديد عقدة تنظيمية افتراضية من بين العقد المختارة.');
      return;
    }

    setSaving(true);
    try {
      const payload: RegisterUserInput = {
        fullName: trimmedName,
        email: trimmedEmail,
        password,
        ...(roleCode ? { roleCode } : {}),
        ...(selectedNodeIds.length > 0
          ? {
              organizationNodeIds: selectedNodeIds,
              primaryOrganizationNodeId: defaultNodeId,
            }
          : {}),
      };

      const created = await registerUser(payload);
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

        {/* Organization Nodes Section */}
        <div className="admin-field--full" style={{ marginTop: '8px' }}>
          <label className="field__label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            الوحدات التنظيمية (نطاق العمل)
          </label>
          <small style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
            حدد الوحدات التنظيمية التي يحق للمستخدم العمل ضمنها (اختياري). تركها فارغة يمنح صلاحيات على مستوى المؤسسة بالكامل.
          </small>

          {nodesLoading ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '8px 0' }}>
              جاري تحميل الوحدات التنظيمية…
            </div>
          ) : nodesError ? (
            <div style={{ color: 'var(--color-danger, #b3261e)', fontSize: '13px', padding: '8px 0' }}>
              {nodesError}
            </div>
          ) : authorizedNodes.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '8px 0' }}>
              لا توجد وحدات تنظيمية متاحة لك لإدارتها.
            </div>
          ) : (
            <div
              style={{
                maxHeight: '160px',
                overflowY: 'auto',
                border: '1px solid var(--color-border, #e0e0e0)',
                borderRadius: '6px',
                padding: '8px 12px',
                background: 'var(--color-bg-surface, #fff)',
              }}
            >
              {authorizedNodes.map((node) => {
                const checked = selectedNodeIds.includes(node.id);
                return (
                  <label
                    key={node.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 0',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNode(node.id)}
                    />
                    <span>{node.shortName ? `${node.name} (${node.shortName})` : node.name}</span>
                    {node.code && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>[{node.code}]</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Default Organization Node Selector */}
        {selectedNodeIds.length > 0 && (
          <label className="field admin-field--full" style={{ marginTop: '8px' }}>
            العقدة التنظيمية الافتراضية (مكان البدء)
            <select
              value={defaultNodeId ?? ''}
              onChange={(e) => setDefaultNodeId(Number(e.target.value) || null)}
              required
            >
              {selectedNodeIds.map((id) => {
                const n = authorizedNodes.find((node) => node.id === id);
                return (
                  <option key={id} value={id}>
                    {n ? (n.shortName ? `${n.name} (${n.shortName})` : n.name) : id}
                  </option>
                );
              })}
            </select>
            <small>العقدة التي يبدأ منها المستخدم جلسة عمله تلقائياً. يجب أن تكون إحدى العقد المختارة أعلاه.</small>
          </label>
        )}
      </div>
    </FormDialog>
  );
}