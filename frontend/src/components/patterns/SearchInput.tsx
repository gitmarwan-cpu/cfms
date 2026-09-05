import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

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
export default function SearchInput({ label, value, onChange, placeholder, onSubmit, className }: SearchInputProps) {
  const id = useId();
  return (
    <div className={cn("ds-field", className)}>
      <label className="ds-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative flex items-center">
        <Search size={16} aria-hidden="true" className="absolute right-3 text-muted-foreground pointer-events-none" />
        <input
          id={id}
          type="search"
          className="ds-input pl-10 pr-10"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onSubmit) onSubmit();
          }}
        />
        {value !== '' && (
          <button type="button" className="absolute left-2 p-1.5 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => onChange('')} aria-label="مسح البحث">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
