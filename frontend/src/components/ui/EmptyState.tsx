import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Contextual empty state: icon + title + optional description + optional action. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('ds-empty', className)}>
      {Icon && (
        <span className="ds-empty__icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      )}
      <p className="ds-empty__title">{title}</p>
      {description && <p className="ds-empty__description">{description}</p>}
      {action}
    </div>
  );
}
