import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * RTL-first breadcrumbs. The chevron separator is authored for the RTL reading
 * direction and mirrored for LTR in patterns.css — icons are never hardcoded
 * to one physical side.
 */
export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav className="ptn-breadcrumbs" aria-label="مسار التنقل">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <ChevronLeft size={14} aria-hidden="true" className="ptn-breadcrumbs__sep" />
            )}
            {isLast || !item.to ? (
              <span className="ptn-breadcrumbs__current" aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link className="ptn-breadcrumbs__link" to={item.to}>
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
