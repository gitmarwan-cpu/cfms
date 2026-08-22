import { type FormEvent, type ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="admin-page-header"><div><h1 className="admin-page-title">{title}</h1>{description && <p className="admin-page-description">{description}</p>}</div>{actions && <div className="admin-page-actions">{actions}</div>}</div>;
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="admin-skeleton" aria-label="جارٍ التحميل">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}

export function DataState({ loading, error, empty, onRetry, children }: { loading: boolean; error: string; empty: boolean; onRetry: () => void; children: ReactNode }) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <div className="admin-state admin-state--error" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={onRetry}>إعادة المحاولة</button></div>;
  if (empty) return <div className="admin-state"><p>لا توجد بيانات لعرضها حالياً.</p><button className="btn btn-outline" onClick={onRetry}>تحديث</button></div>;
  return <>{children}</>;
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="admin-dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="admin-dialog-title">{title}</h2><button className="admin-icon-button" onClick={onClose} aria-label="إغلاق">×</button></header>{children}</section></div>;
}

export function FormDialog({ title, onClose, onSubmit, saving, error, children, submitLabel = 'حفظ' }: { title: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean; error: string; children: ReactNode; submitLabel?: string }) {
  return <Dialog title={title} onClose={onClose}><form className="admin-dialog__form" onSubmit={onSubmit}>{error && <div className="alert alert-danger" role="alert">{error}</div>}{children}<footer><button className="btn btn-outline" type="button" onClick={onClose}>إلغاء</button><button className="btn btn-primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : submitLabel}</button></footer></form></Dialog>;
}

export function ConfirmDialog({ title, message, onClose, onConfirm, busy = false }: { title: string; message: string; onClose: () => void; onConfirm: () => void; busy?: boolean }) {
  return <Dialog title={title} onClose={onClose}><div className="admin-confirm"><p>{message}</p><footer><button className="btn btn-outline" onClick={onClose}>إلغاء</button><button className="btn admin-btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'جارٍ التنفيذ…' : 'تأكيد الحذف'}</button></footer></div></Dialog>;
}
