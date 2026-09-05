import type { OrganizationNode } from '../../../types/organization';
import { StatusBadge } from '../../ui/StatusBadge';
import type { OrganizationNodeDto } from '../../../api/adminApi';
import { Building2, ChevronLeft, Layers, X } from 'lucide-react';
import AuditMetadata from '../AuditMetadata';
import { getHierarchyPath } from '../../../utils/organizationTree';

interface OrganizationDetailsProps {
  node: OrganizationNode;
  allNodes: OrganizationNodeDto[];
  canManage: boolean;
  onAddChild: (node: OrganizationNode) => void;
  onEdit: (node: OrganizationNode) => void;
  onDeactivate: (node: OrganizationNode) => void;
  onActivate: (node: OrganizationNode) => void;
  onClose: () => void;
}

export default function OrganizationDetails({
  node,
  allNodes,
  canManage,
  onAddChild,
  onEdit,
  onDeactivate,
  onActivate,
  onClose,
}: OrganizationDetailsProps) {
  // Compute breadcrumb path for parent hierarchy context
  const fullHierarchyPath = getHierarchyPath(node.id, allNodes.map((n) => ({ ...n, children: [], depth: 0 })));
  const parentNode = node.parentId ? allNodes.find((n) => n.id === node.parentId) : null;

  return (
    <div className="card admin-details-card">
      <div className="card__header od-head">
        <div>
          <div className="od-title-row">
            <span className="od-icon">{node.parentId === null ? <Building2 size={18} aria-hidden="true" /> : <Layers size={18} aria-hidden="true" />}</span>
            <h2 className="od-title">{node.name}</h2>
          </div>
          {node.shortName && (
            <span className="admin-muted od-shortname">
              الاسم المختصر: {node.shortName}
            </span>
          )}
        </div>

        <div className="od-actions">
          <StatusBadge tone={node.isActive ? 'success' : 'neutral'}>{node.isActive ? 'نشط' : 'معطّل'}</StatusBadge>

          {canManage && (
            <>
              <button
                type="button"
                className="btn btn-outline od-btn"
                onClick={() => onAddChild(node)}
              >
                + فرع تابع
              </button>
              <button
                type="button"
                className="btn btn-outline od-btn"
                onClick={() => onEdit(node)}
              >
                تعديل
              </button>
              {node.isActive && (
                <button
                  type="button"
                  className="btn btn-outline od-btn od-danger"
                  onClick={() => onDeactivate(node)}
                >
                  تعطيل
                </button>
              )}
              {!node.isActive && (
                <button
                  type="button"
                  className="btn btn-outline od-btn od-success"
                  onClick={() => onActivate(node)}
                >
                  تفعيل
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="od-close"
            onClick={onClose}
            aria-label="إغلاق تفاصيل الوحدة"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="card__body">
        {/* Hierarchy path breadcrumb */}
        {fullHierarchyPath.length > 1 && (
          <div className="admin-hierarchy-breadcrumb od-breadcrumb">
            <strong>المسار الهرمي:</strong>
            {fullHierarchyPath.map((item, idx) => (
              <span key={item.id} className={item.id === node.id ? 'od-crumb od-crumb--current' : 'od-crumb'}>
                {idx > 0 && <ChevronLeft size={12} className="od-crumb-sep" aria-hidden="true" />}
                {item.name}
              </span>
            ))}
          </div>
        )}

        <div className="admin-detail-fields od-fields">
          <div>
            <span className="admin-detail-label">اسم الوحدة التنظيمية</span>
            <span className="admin-detail-value">{node.name}</span>
          </div>

          <div>
            <span className="admin-detail-label">الرمز المرجعي</span>
            <span className="admin-detail-value">{node.code || <span className="admin-muted">غير محدد</span>}</span>
          </div>

          <div>
            <span className="admin-detail-label">نوع الوحدة التنظيمية</span>
            <span className="admin-detail-value">
              {node.unitType ? (
                <span className="admin-tree-type-tag od-type-tag">{node.unitType.nameAr}</span>
              ) : (
                <span className="admin-muted">غير محدد</span>
              )}
            </span>
          </div>

          <div>
            <span className="admin-detail-label">الوحدة التنظيمية الأم</span>
            <span className="admin-detail-value">
              {parentNode ? (
                <>
                  {parentNode.name}
                  {parentNode.code && <small className="admin-muted od-paren">({parentNode.code})</small>}
                </>
              ) : (
                <span className="admin-muted">وحدة جذرية الرئيسية</span>
              )}
            </span>
          </div>

          {node.phone && (
            <div>
              <span className="admin-detail-label">الهاتف</span>
              <span className="admin-detail-value od-ltr" dir="ltr">{node.phone}</span>
            </div>
          )}

          {node.email && (
            <div>
              <span className="admin-detail-label">البريد الإلكتروني</span>
              <span className="admin-detail-value od-ltr" dir="ltr">{node.email}</span>
            </div>
          )}

          {node.address && (
            <div className="od-span-full">
              <span className="admin-detail-label">العنوان</span>
              <span className="admin-detail-value">{node.address}</span>
            </div>
          )}
        </div>

        <div className="od-audit">
          <h3 className="od-audit-title">معلومات السجل والتدقيق</h3>
          <AuditMetadata createdAt={node.createdAt} updatedAt={node.updatedAt} />
        </div>
      </div>
    </div>
  );
}
