import type { OrganizationNode } from '../../../types/organization';
import type { OrganizationNodeDto } from '../../../api/adminApi';
import AuditMetadata from '../AuditMetadata';
import { getHierarchyPath } from '../../../utils/organizationTree';

interface OrganizationDetailsProps {
  node: OrganizationNode;
  allNodes: OrganizationNodeDto[];
  canManage: boolean;
  onAddChild: (node: OrganizationNode) => void;
  onEdit: (node: OrganizationNode) => void;
  onDeactivate: (node: OrganizationNode) => void;
  onClose: () => void;
}

export default function OrganizationDetails({
  node,
  allNodes,
  canManage,
  onAddChild,
  onEdit,
  onDeactivate,
  onClose,
}: OrganizationDetailsProps) {
  // Compute breadcrumb path for parent hierarchy context
  const fullHierarchyPath = getHierarchyPath(node.id, allNodes.map((n) => ({ ...n, children: [], depth: 0 })));
  const parentNode = node.parentId ? allNodes.find((n) => n.id === node.parentId) : null;

  return (
    <div className="card admin-details-card">
      <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.2rem' }}>{node.parentId === null ? '🏢' : '▦'}</span>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>{node.name}</h2>
          </div>
          {node.shortName && (
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              الاسم المختصر: {node.shortName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`admin-status-pill ${node.isActive ? 'is-success' : ''}`}>
            {node.isActive ? 'نشط' : 'معطّل'}
          </span>

          {canManage && (
            <>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '5px 10px' }}
                onClick={() => onAddChild(node)}
              >
                + فرع تابع
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '12px', padding: '5px 10px' }}
                onClick={() => onEdit(node)}
              >
                تعديل
              </button>
              {node.isActive && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '12px', padding: '5px 10px', color: 'var(--color-danger, #c0392b)' }}
                  onClick={() => onDeactivate(node)}
                >
                  تعطيل
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '12px', padding: '5px 10px' }}
            onClick={onClose}
            aria-label="إغلاق تفاصيل الوحدة"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="card__body">
        {/* Hierarchy path breadcrumb */}
        {fullHierarchyPath.length > 1 && (
          <div className="admin-hierarchy-breadcrumb" style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-muted)', background: 'var(--color-bg-subtle, #f8f9fa)', padding: '8px 12px', borderRadius: '4px' }}>
            <strong style={{ marginLeft: '6px' }}>المسار الهرمي:</strong>
            {fullHierarchyPath.map((item, idx) => (
              <span key={item.id}>
                {idx > 0 && <span style={{ margin: '0 4px' }}>←</span>}
                <span style={{ fontWeight: item.id === node.id ? 600 : 400, color: item.id === node.id ? 'var(--color-primary)' : 'inherit' }}>
                  {item.name}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="admin-detail-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <span className="admin-detail-label">اسم الوحدة التنظيمية</span>
            <span className="admin-detail-value">{node.name}</span>
          </div>

          <div>
            <span className="admin-detail-label">الرمز المرجعي</span>
            <span className="admin-detail-value">{node.code || <span style={{ color: 'var(--color-text-muted)' }}>غير محدد</span>}</span>
          </div>

          <div>
            <span className="admin-detail-label">نوع الوحدة التنظيمية</span>
            <span className="admin-detail-value">
              {node.unitType ? (
                <span className="admin-tree-type-tag" style={{ fontSize: '12px' }}>{node.unitType.nameAr}</span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>غير محدد</span>
              )}
            </span>
          </div>

          <div>
            <span className="admin-detail-label">الوحدة التنظيمية الأم</span>
            <span className="admin-detail-value">
              {parentNode ? (
                <>
                  {parentNode.name}
                  {parentNode.code && <small style={{ color: 'var(--color-text-muted)', marginRight: '4px' }}>({parentNode.code})</small>}
                </>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>وحدة جذرية الرئيسية</span>
              )}
            </span>
          </div>

          {node.phone && (
            <div>
              <span className="admin-detail-label">الهاتف</span>
              <span className="admin-detail-value" dir="ltr" style={{ display: 'inline-block' }}>{node.phone}</span>
            </div>
          )}

          {node.email && (
            <div>
              <span className="admin-detail-label">البريد الإلكتروني</span>
              <span className="admin-detail-value" dir="ltr" style={{ display: 'inline-block' }}>{node.email}</span>
            </div>
          )}

          {node.address && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span className="admin-detail-label">العنوان</span>
              <span className="admin-detail-value">{node.address}</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
          <h3 style={{ fontSize: '0.92rem', margin: '0 0 10px', color: 'var(--color-text-muted)' }}>معلومات السجل والتدقيق</h3>
          <AuditMetadata createdAt={node.createdAt} updatedAt={node.updatedAt} />
        </div>
      </div>
    </div>
  );
}
