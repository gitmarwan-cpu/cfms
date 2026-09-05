import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** start = inline-start edge (right side in RTL), end = inline-end edge. */
  side?: 'start' | 'end';
}

/**
 * Side drawer on Radix Dialog (focus trap/restore, Escape, outside click).
 * Positioned with logical inset properties — mirrors correctly in RTL.
 * Used for: user detail, audit detail, mobile navigation.
 */
export function Drawer({ open, onOpenChange, title, description, children, side = 'end' }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ds-overlay" />
        <DialogPrimitive.Content className={cn('ds-drawer', side === 'start' && 'ds-drawer--start')}>
          <header className="ds-drawer-header">
            <div>
              <DialogPrimitive.Title className="ds-drawer-title">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="ds-dialog-description">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <button type="button" className="ds-btn ds-btn--ghost ds-btn--icon" aria-label="إغلاق">
                <X size={18} aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
