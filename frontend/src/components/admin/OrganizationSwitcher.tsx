import { useEffect, useRef, useState } from 'react';
import { Building2, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Organization switcher for the admin header.
 *
 * - Renders the current organization name (never a bare numeric id).
 * - The dropdown is available only when the user has MORE THAN ONE membership
 *   confirmed by /auth/me; with a single membership it degrades to a label.
 * - Switching only ever targets memberships the backend confirmed; the
 *   backend re-validates the X-Organization-Id header on every request.
 * - Keyboard accessible (Escape closes, native focus order), RTL-friendly,
 *   mobile-safe (constrained dropdown width), duplicate-switch guarded.
 */
export default function OrganizationSwitcher() {
  const { organizations, currentOrganization, currentOrganizationId, switchOrganization, isSwitching } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!currentOrganization) return null;

  const canSwitch = organizations.length > 1;
  const normalizedQuery = query.trim();
  const filtered =
    normalizedQuery.length > 0
      ? organizations.filter(
          (org) => org.name.includes(normalizedQuery) || (org.shortName ?? '').includes(normalizedQuery)
        )
      : organizations;
  const showSearch = organizations.length > 8;

  return (
    <div className="org-switcher" ref={containerRef}>
      <button
        type="button"
        className="org-switcher__trigger"
        onClick={() => canSwitch && setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isSwitching}
        title={currentOrganization.name}
      >
        <span className="org-switcher__icon" aria-hidden="true"><Building2 size={18} /></span>
        <span className="org-switcher__name">{currentOrganization.name}</span>
        {canSwitch && <span className="org-switcher__chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>}
      </button>

      {open && canSwitch && (
        <div className="org-switcher__menu" role="listbox" aria-label="تبديل المؤسسة النشطة">
          {showSearch && (
            <div className="org-switcher__search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث في المؤسسات…"
                aria-label="بحث في المؤسسات"
              />
            </div>
          )}
          <div className="org-switcher__options">
            {filtered.length === 0 && <p className="org-switcher__empty">لا توجد نتائج</p>}
            {filtered.map((org) => {
              const isCurrent = org.id === currentOrganizationId;
              return (
                <button
                  key={org.id}
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  className={`org-switcher__option ${isCurrent ? 'org-switcher__option--current' : ''}`}
                  disabled={isSwitching || isCurrent}
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    switchOrganization(org.id);
                  }}
                >
                  <span className="org-switcher__option-name">{org.name}</span>
                  {org.isPrimary && <span className="org-switcher__badge">الأساسية</span>}
                  {isCurrent && <span className="org-switcher__check" aria-hidden="true"><Check size={14} /></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}