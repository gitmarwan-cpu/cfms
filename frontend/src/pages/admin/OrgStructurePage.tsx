import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deactivateOrganizationNode,
  fetchOrganizationNodes,
  fetchOrgUnitTypes,
  type OrganizationNodeDto,
  type OrgUnitType,
} from '../../api/adminApi';
import type { ApiClientError } from '../../api/axiosClient';
import { ConfirmDialog, DataState, PageHeader } from '../../components/admin/AdminUi';
import OrganizationDetails from '../../components/admin/organization/OrganizationDetails';
import OrganizationNodeForm from '../../components/admin/organization/OrganizationNodeForm';
import OrganizationTree from '../../components/admin/organization/OrganizationTree';
import { useAuth } from '../../context/AuthContext';
import { fromOrganizationNodeDto, type OrganizationNode } from '../../types/organization';
import { buildOrgTree, filterOrgTree } from '../../utils/organizationTree';

export default function OrgStructurePage() {
  const { user, hasPermission } = useAuth();
  const orgId = user?.defaultOrganizationId ?? null;

  const canView = orgId !== null && (hasPermission('org_structure.view', orgId) || hasPermission('organization.view', orgId));
  const canManage = orgId !== null && (hasPermission('org_structure.manage', orgId) || hasPermission('organization.manage', orgId));

  // ── Raw state ──────────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<OrganizationNodeDto[]>([]);
  const [types, setTypes] = useState<OrgUnitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  // ── Selection & Form state ──────────────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrganizationNodeDto | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);

  // ── Deactivate confirmation ─────────────────────────────────────────────────
  const [deactivatingNode, setDeactivatingNode] = useState<OrganizationNodeDto | null>(null);
  const [deactivatingBusy, setDeactivatingBusy] = useState(false);

  // ── Load data from backend (/organization/nodes and /org-structure/unit-types) ──
  const loadData = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([fetchOrganizationNodes(), fetchOrgUnitTypes()])
      .then(([n, t]) => {
        setNodes(n);
        const firstNode = n[0];
        if (firstNode && selectedNodeId === null) {
          setSelectedNodeId(firstNode.id);
        }
      })
      .catch((err: ApiClientError) => {
        setError(err.message || 'تعذر تحميل بيانات الهيكل التنظيمي.');
      })
      .finally(() => setLoading(false));
  }, [selectedNodeId]);

  useEffect(() => {
    if (canView) loadData();
  }, [loadData, canView]);

  // ── Build tree and apply client-side search ─────────────────────────────────
  const fullTreeRoots = useMemo(() => {
    const formatted = nodes.map(fromOrganizationNodeDto);
    return buildOrgTree(formatted);
  }, [nodes]);

  const displayedTreeRoots = useMemo(() => {
    return filterOrgTree(fullTreeRoots, search);
  }, [fullTreeRoots, search]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const dto = nodes.find((n) => n.id === selectedNodeId);
    if (!dto) return null;
    return fromOrganizationNodeDto(dto);
  }, [nodes, selectedNodeId]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddRootNode = () => {
    setEditingNode(null);
    setDefaultParentId(null);
    setFormOpen(true);
  };

  const handleAddChildNode = (parent: OrganizationNode) => {
    setEditingNode(null);
    setDefaultParentId(parent.id);
    setFormOpen(true);
  };

  const handleEditNode = (node: OrganizationNode) => {
    const dto = nodes.find((n) => n.id === node.id) || node;
    setEditingNode(dto);
    setDefaultParentId(null);
    setFormOpen(true);
  };

  const handleDeactivatePrompt = (node: OrganizationNode) => {
    const dto = nodes.find((n) => n.id === node.id) || node;
    setDeactivatingNode(dto);
  };

  const confirmDeactivate = async () => {
    if (!deactivatingNode) return;
    setDeactivatingBusy(true);
    try {
      await deactivateOrganizationNode(deactivatingNode.id);
      setNotice(`تم تعطيل الوحدة التنظيمية «${deactivatingNode.name}» بنجاح.`);
      setDeactivatingNode(null);
      loadData();
    } catch (err) {
      setError((err as ApiClientError).message || 'تعذر تعطيل الوحدة التنظيمية.');
      setDeactivatingNode(null);
    } finally {
      setDeactivatingBusy(false);
    }
  };

  const handleSaved = (savedNode: OrganizationNodeDto) => {
    setFormOpen(false);
    setSelectedNodeId(savedNode.id);
    setNotice(`تم حفظ الوحدة التنظيمية «${savedNode.name}» بنجاح.`);
    loadData();
  };

  // ── Permission Guard ────────────────────────────────────────────────────────
  if (!user) return null;

  if (!canView) {
    return (
      <div>
        <PageHeader title="الهيكل التنظيمي" description="الوحدات التنظيمية وعلاقاتها الهرمية ضمن المؤسسة." />
        <div className="card">
          <div className="card__body">
            <p>ليس لديك صلاحية «org_structure.view» لعرض الهيكل التنظيمي لهذه المؤسسة.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="الهيكل التنظيمي"
        description="الوحدات التنظيمية وعلاقاتها الهرمية ضمن المؤسسة (المصدر: جدول المؤسسات organizations)."
        actions={
          canManage && (
            <button className="btn btn-primary" onClick={handleAddRootNode} type="button">
              + إضافة وحدة جذرية
            </button>
          )
        }
      />

      {notice && (
        <div className="admin-success" role="status" style={{ marginBottom: '16px' }}>
          {notice}
          <button
            type="button"
            className="admin-text-button"
            style={{ marginRight: '12px', fontSize: '12px' }}
            onClick={() => setNotice('')}
            aria-label="إغلاق الإشعار"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="card admin-filter-bar" style={{ marginBottom: '16px' }}>
        <label className="field" style={{ flex: 1, minWidth: '240px', maxWidth: '480px' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الرمز، أو نوع الوحدة التنظيمية…"
            aria-label="بحث في الهيكل التنظيمي"
          />
        </label>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && !error && nodes.length === 0}
        onRetry={loadData}
      >
        <div className="org-structure-layout">
          {/* Tree Column */}
          <div className="org-structure-tree-col">
            <OrganizationTree
              nodes={displayedTreeRoots}
              selectedId={selectedNodeId}
              canManage={canManage}
              onSelect={(n) => setSelectedNodeId(n.id)}
              onAddChild={handleAddChildNode}
              onEdit={handleEditNode}
              onDeactivate={handleDeactivatePrompt}
            />
          </div>

          {/* Details Column */}
          {selectedNode ? (
            <div className="org-structure-detail-col">
              <OrganizationDetails
                node={selectedNode}
                allNodes={nodes}
                canManage={canManage}
                onAddChild={handleAddChildNode}
                onEdit={handleEditNode}
                onDeactivate={handleDeactivatePrompt}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          ) : (
            <div className="org-structure-detail-col org-structure-detail-col--empty">
              <div className="card">
                <div className="card__body" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-text-muted)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>▦</div>
                  <p style={{ margin: 0 }}>اختر وحدة تنظيمية من الشجرة الهرمية لعرض التفاصيل الكاملة.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DataState>

      {/* Create / Edit Dialog */}
      {formOpen && (
        <OrganizationNodeForm
          editingNode={editingNode}
          defaultParentId={defaultParentId}
          allNodes={nodes}
          types={types}
          onClose={() => setFormOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Deactivate Confirmation Dialog */}
      {deactivatingNode && (
        <ConfirmDialog
          title="تأكيد تعطيل الوحدة التنظيمية"
          message={`هل أنت متأكد من تعطيل الوحدة التنظيمية «${deactivatingNode.name}»؟`}
          onClose={() => setDeactivatingNode(null)}
          onConfirm={confirmDeactivate}
          busy={deactivatingBusy}
        />
      )}
    </div>
  );
}