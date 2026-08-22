import type { OrgUnit } from '../../api/adminApi';
import type { OrgTreeNode } from '../../utils/orgHierarchy';

export function OrgUnitTreeItem({
  node,
  onEdit,
  onDeactivate,
}: {
  node: OrgTreeNode;
  onEdit: (unit: OrgUnit) => void;
  onDeactivate: (unit: OrgUnit) => void;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <div className="admin-tree-row" style={{ marginInlineStart: `${node.depth * 24}px` }}>
      <span>
        <strong>{node.name}</strong>
        <small>
          {node.unitType?.nameAr || '—'} · {node.code || 'بلا رمز'}
          {hasChildren ? ` (${node.children.length})` : ''}
        </small>
      </span>
      <span className="admin-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {!node.isActive && <span className="admin-status-badge admin-status-badge--inactive" style={{ fontSize: '11px' }}>معطّل</span>}
        <button className="btn btn-outline" type="button" style={{ padding: '4px 10px', fontSize: '13px' }} onClick={() => onEdit(node)}>تعديل</button>
        {node.isActive && (
          <button className="admin-btn-danger" type="button" style={{ padding: '4px 10px', fontSize: '13px' }} onClick={() => onDeactivate(node)}>تعطيل</button>
        )}
      </span>
    </div>
  );
}

export function OrgUnitTree({
  nodes,
  onEdit,
  onDeactivate,
}: {
  nodes: OrgTreeNode[];
  onEdit: (unit: OrgUnit) => void;
  onDeactivate: (unit: OrgUnit) => void;
}) {
  return (
    <div className="card admin-tree">
      {nodes.map((node) => (
        <div key={node.id}>
          <OrgUnitTreeItem node={node} onEdit={onEdit} onDeactivate={onDeactivate} />
          {node.children.length > 0 && (
            <OrgUnitTree nodes={node.children} onEdit={onEdit} onDeactivate={onDeactivate} />
          )}
        </div>
      ))}
    </div>
  );
}