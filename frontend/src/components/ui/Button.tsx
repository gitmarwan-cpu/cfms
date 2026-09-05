import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables interaction while true. */
  loading?: boolean;
}

/**
 * Design-system button. Icon-only sizes MUST receive an accessible label
 * (aria-label / aria-labelledby) — enforced by review, not runtime.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, type, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="ui-btn__spinner" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
});
