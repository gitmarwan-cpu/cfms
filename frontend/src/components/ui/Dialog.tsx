import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Radix provides focus trap, focus restore, Escape and outside-click. */
}

/**
 * Design-system modal dialog on Radix Dialog.
 * Accessibility: focus trap, focus restoration, Escape, labelled by title,
 * described by optional description. RTL handled by DirectionProvider.
 */
export function Dialog({ open, onOpenChange, title, description, children, size = 'md' }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ds-overlay" />
        <DialogPrimitive.Content className={cn('ds-dialog', size !== 'md' && `ds-dialog--${size}`)}>
          <header className="ds-drawer-header">
            <div>
              <DialogPrimitive.Title className="ds-dialog-title">{title}</DialogPrimitive.Title>
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
