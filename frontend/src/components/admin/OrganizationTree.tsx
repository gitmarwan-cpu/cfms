import { useEffect, useState, type ReactNode } from 'react';
import type { OrganizationNode } from '../../types/organization';

interface OrganizationTreeProps {
  nodes: OrganizationNode[];
  onEdit: (node: OrganizationNode) => void;
  onDeactivate: (node: OrganizationNode) => void;
}

export default function OrganizationTree({ nodes, onEdit, onDeactivate }: OrganizationTreeProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Newly loaded nodes start expanded so the tree mirrors the original
  // flat-list behavior (all units visible) until the user collapses them.
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
          collect(n.children);
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

  return (
    <div className="card admin-tree" role="tree">
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          expanded={expanded}
          onToggle={toggle}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: OrganizationNode;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (node: OrganizationNode) => void;
  onDeactivate: (node: OrganizationNode) => void;
}

function TreeNode({ node, expanded, onToggle, onEdit, onDeactivate }: TreeNodeProps): ReactNode {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <>
      <div
        className="admin-tree-row"
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        style={{ paddingInlineStart: `${12 + node.depth * 24}px` }}
      >
        <span className="admin-tree-label">
          {hasChildren ? (
            <button
              className="admin-tree-toggle"
              onClick={() => onToggle(node.id)}
              aria-label={isExpanded ? 'طي' : 'توسيع'}
              type="button"
            >
              {isExpanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="admin-tree-spacer" />
          )}
          <strong>{node.name}</strong>
          <small>{node.unitType?.nameAr ?? '—'} · {node.code || 'بلا رمز'}</small>
        </span>
        <span className="admin-actions">
          {!node.isActive && <span className="admin-status-pill">غير نشط</span>}
          {node.isActive && <span className="admin-status-pill is-success">نشط</span>}
          <button className="btn btn-outline" onClick={() => onEdit(node)} type="button">تعديل</button>
          {node.isActive && (
            <button className="admin-text-button danger" onClick={() => onDeactivate(node)} type="button">إلغاء التنشيط</button>
          )}
        </span>
      </div>
      {hasChildren && isExpanded && node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          expanded={expanded}
          onToggle={onToggle}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
        />
      ))}
    </>
  );
}