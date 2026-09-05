import { useId, type ReactNode, type TextareaHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (ids: { fieldId: string; describedBy: string | undefined }) => ReactNode;
}

/**
 * FormField shell: label + control + hint/error.
 * The control receives id/aria-describedby/aria-invalid via render prop so the
 * error is programmatically associated (WCAG 3.3.1) without duplicating ids.
 */
export function FormField({ label, error, hint, required, children }: FieldShellProps) {
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="ds-field">
      <label className="ds-label" htmlFor={fieldId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({ fieldId, describedBy })}
      {hint && <p className="ds-hint" id={hintId}>{hint}</p>}
      {error && <p className="ds-field-error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, required, className, ...props }: InputProps) {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      {({ fieldId, describedBy }) => (
        <input
          {...props}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('ds-input', className)}
        />
      )}
    </FormField>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Select({ label, error, hint, required, className, children, ...props }: SelectProps) {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      {({ fieldId, describedBy }) => (
        <select
          {...props}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('ds-select', className)}
        >
          {children}
        </select>
      )}
    </FormField>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, required, className, ...props }: TextareaProps) {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      {({ fieldId, describedBy }) => (
        <textarea
          {...props}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('ds-textarea', className)}
        />
      )}
    </FormField>
  );
}
