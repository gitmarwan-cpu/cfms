import { useEffect, useState, type ReactNode, type KeyboardEvent } from 'react';
import { StatusBadge } from '../../ui/StatusBadge';
import type { OrganizationNode } from '../../../types/organization';
import { Building2, ChevronDown, ChevronLeft, Layers } from 'lucide-react';

interface OrganizationTreeProps {
  nodes: OrganizationNode[];
  selectedId: number | null;
  canManage: boolean;
  onSelect: (node: OrganizationNode) => void;
  onAddChild: (node: OrganizationNode) => void;
  onEdit: (node: OrganizationNode) => void;
  onDeactivate: (node: OrganizationNode) => void;
  onActivate: (node: OrganizationNode) => void;
}

export default function OrganizationTree({
  nodes,
  selectedId,
  canManage,
  onSelect,
  onAddChild,
  onEdit,
  onDeactivate,
  onActivate,
}: OrganizationTreeProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Expand all nodes initially when nodes change
  useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      const collect = (list: OrganizationNode[]) => {
        for (const n of list) {
          if (!next.has(n.id)) {
            next.add(n.id);
            changed = true;
          }
          if (n.children && n.children.length > 0) {
            collect(n.children);
          }
        }
      };
      collect(nodes);
      return changed ? next : prev;
    });
  }, [nodes]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<number>();
    const collect = (list: OrganizationNode[]) => {
      for (const n of list) {
        all.add(n.id);
        if (n.children) collect(n.children);
      }
    };
    collect(nodes);
    setExpanded(all);
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  return (
    <div className="card admin-tree-card">
      <div className="card__header admin-tree-header">
        <h2 className="ot-heading">الهيكل التنظيمي</h2>
        <div className="ot-actions">
          <button
            type="button"
            className="btn btn-outline ot-btn"
            onClick={expandAll}
            title="توسيع الكل"
          >
            توسيع الكل
          </button>
          <button
            type="button"
            className="btn btn-outline ot-btn"
            onClick={collapseAll}
            title="طي الكل"
          >
            طي الكل
          </button>
        </div>
      </div>

      <div className="card__body ot-body">
        <div className="admin-tree" role="tree" aria-label="شجرة الهيكل التنظيمي">
          {nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              selectedId={selectedId}
              expanded={expanded}
              canManage={canManage}
              onToggle={toggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
              onActivate={onActivate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: OrganizationNode;
  selectedId: number | null;
  expanded: Set<number>;
  canManage: boolean;
  onToggle: (id: number) => void;
  onSelect: (node: OrganizationNode) => void;
  onAddChild: (node: OrganizationNode) => void;
  onEdit: (node: OrganizationNode) => void;
  onDeactivate: (node: OrganizationNode) => void;
  onActivate: (node: OrganizationNode) => void;
}

function TreeNode({
  node,
  selectedId,
  expanded,
  canManage,
  onToggle,
  onSelect,
  onAddChild,
  onEdit,
  onDeactivate,
  onActivate,
}: TreeNodeProps): ReactNode {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(node);
    } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      onToggle(node.id);
    } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      onToggle(node.id);
    }
  };

  return (
    <>
      <div
        className={`admin-tree-row ${isSelected ? 'admin-tree-row--selected' : ''}`}
        role="treeitem"
        tabIndex={0}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        onClick={() => onSelect(node)}
        onKeyDown={handleKeyDown}
        style={{ paddingInlineStart: `${12 + node.depth * 22}px` }}
      >
        <span className="admin-tree-label">
          {hasChildren ? (
            <button
              className="admin-tree-toggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
              aria-label={isExpanded ? `طي ${node.name}` : `توسيع ${node.name}`}
              type="button"
            >
              {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronLeft size={14} aria-hidden="true" />}
            </button>
          ) : (
            <span className="admin-tree-spacer" aria-hidden="true" />
          )}

          <span className="admin-tree-node-icon" aria-hidden="true">
            {node.parentId === null ? <Building2 size={15} aria-hidden="true" /> : <Layers size={15} aria-hidden="true" />}
          </span>

          <span className="admin-tree-title">
            <strong>{node.name}</strong>
            {node.shortName && <span className="admin-tree-short-name"> ({node.shortName})</span>}
          </span>

          <span className="admin-tree-meta">
            {node.unitType ? (
              <span className="admin-tree-type-tag">{node.unitType.nameAr}</span>
            ) : null}
            {node.code && <span className="admin-tree-code-badge">{node.code}</span>}
          </span>
        </span>

        <span className="admin-tree-actions" onClick={(e) => e.stopPropagation()}>
          <StatusBadge tone={node.isActive ? 'success' : 'neutral'}>{node.isActive ? 'نشط' : 'معطّل'}</StatusBadge>

          {canManage && (
            <>
              <button
                type="button"
                className="btn btn-outline ot-btn"
                onClick={() => onAddChild(node)}
                title="إضافة فرع/وحدة جديدة تحت هذه الوحدة"
                aria-label={`إضافة فرع تحت ${node.name}`}
              >
                + فرع
              </button>
              <button
                type="button"
                className="btn btn-outline ot-btn"
                onClick={() => onEdit(node)}
                aria-label={`تعديل ${node.name}`}
              >
                تعديل
              </button>
              {node.isActive && (
                <button
                  type="button"
                  className="admin-text-button danger ot-danger"
                  onClick={() => onDeactivate(node)}
                  aria-label={`تعطيل ${node.name}`}
                >
                  تعطيل
                </button>
              )}
              {!node.isActive && (
                <button
                  type="button"
                  className="admin-text-button ot-success"
                  onClick={() => onActivate(node)}
                  aria-label={`تفعيل ${node.name}`}
                >
                  تفعيل
                </button>
              )}
            </>
          )}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div role="group" className="admin-tree-group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              expanded={expanded}
              canManage={canManage}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
              onActivate={onActivate}
            />
          ))}
        </div>
      )}
    </>
  );
}
