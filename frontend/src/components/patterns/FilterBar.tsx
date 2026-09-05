import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}

/** Consistent wrapper for a row of list filters, with an optional reset action. */
export default function FilterBar({ children, onReset, resetLabel = 'مسح عوامل التصفية' }: FilterBarProps) {
  return (
    <div className="ptn-filterbar">
      <div className="ptn-filterbar__fields">{children}</div>
      {onReset && (
        <button type="button" className="ptn-filterbar__reset" onClick={onReset}>
          {resetLabel}
        </button>
      )}
    </div>
  );
}
