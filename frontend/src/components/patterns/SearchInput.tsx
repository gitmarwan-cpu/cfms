import { useId } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Invoked on Enter (e.g. trigger server search). */
  onSubmit?: () => void;
  className?: string;
}

/**
 * Labeled search field with clear affordance. The icon is decorative; the
 * visible <label> carries the accessible name, and the clear button is a real
 * button with its own label.
 */
export default function SearchInput({ label, value, onChange, placeholder, onSubmit, className = '' }: SearchInputProps) {
  const id = useId();
  return (
    <div className={`ptn-search ${className}`.trim()}>
      <label className="ptn-search__label" htmlFor={id}>
        {label}
      </label>
      <div className="ptn-search__control">
        <Search size={16} aria-hidden="true" className="ptn-search__icon" />
        <input
          id={id}
          type="search"
          className="ptn-search__input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onSubmit) onSubmit();
          }}
        />
        {value !== '' && (
          <button type="button" className="ptn-search__clear" onClick={() => onChange('')} aria-label="مسح البحث">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
