import { formatDateTime } from '../../utils/dateTime';

/**
 * Shared audit-metadata presentation block for administrative detail views.
 *
 * The backend exposes audit timestamps as `createdAt` / `updatedAt` (the
 * authoritative API contract). This component maps them to the standardized
 * audit labels (Created At / Last Updated At). The user-facing name fields
 * (`createdBy` / `updatedBy`) are rendered only when the API actually provides
 * a display name for the user — raw internal user IDs are never shown.
 */
export interface AuditMetadataProps {
  /** Record creation timestamp (maps to audit `create_date`). */
  createdAt?: string | Date | null;
  /** Record last-modification timestamp (maps to audit `write_date`). */
  updatedAt?: string | Date | null;
  /** Display name of the creating user (maps to audit `create_uid`). */
  createdBy?: string | null;
  /** Display name of the last-modifying user (maps to audit `write_uid`). */
  updatedBy?: string | null;
  className?: string;
}

export default function AuditMetadata({
  createdAt,
  updatedAt,
  createdBy,
  updatedBy,
  className = '',
}: AuditMetadataProps) {
  return (
    <div className={`admin-detail-fields admin-audit-metadata ${className}`.trim()}>
      {createdBy ? (
        <div>
          <span className="admin-detail-label">أُنشئ بواسطة</span>
          <span className="admin-detail-value">{createdBy}</span>
        </div>
      ) : null}
      <div>
        <span className="admin-detail-label">تاريخ الإنشاء</span>
        <span className="admin-detail-value">{formatDateTime(createdAt)}</span>
      </div>
      {updatedBy ? (
        <div>
          <span className="admin-detail-label">آخر تحديث بواسطة</span>
          <span className="admin-detail-value">{updatedBy}</span>
        </div>
      ) : null}
      <div>
        <span className="admin-detail-label">آخر تحديث</span>
        <span className="admin-detail-value">{formatDateTime(updatedAt)}</span>
      </div>
    </div>
  );
}