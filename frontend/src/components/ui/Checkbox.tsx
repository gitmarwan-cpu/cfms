import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface CheckboxRowProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label text or node displayed next to the checkbox */
  label: ReactNode;
  /** Optional error message */
  error?: string;
}

/**
 * Shared checkbox control for the CFMS design system.
 * Renders a modern, token-styled checkbox with proper RTL alignment,
 * focus ring, checked state, and hover state — no browser default appearance.
 */
export function CheckboxRow({ label, error, className, id, ...props }: CheckboxRowProps) {
  return (
    <div className="ds-checkbox-wrap">
      <label className={cn('ds-checkbox-row', className)}>
        <input
          {...props}
          id={id}
          type="checkbox"
          className="ds-checkbox"
        />
        <span className="ds-checkbox-label">{label}</span>
      </label>
      {error && <p className="ds-field-error" role="alert">{error}</p>}
    </div>
  );
}
