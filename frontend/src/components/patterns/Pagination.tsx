import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Optional total record count shown next to the page indicator. */
  total?: number;
}

/**
 * RTL-first pagination: chevrons are authored for RTL (previous points right)
 * and mirrored under [dir='ltr'] in components.css. Icon-only buttons carry
 * Arabic aria-labels.
 */
export default function Pagination({ page, totalPages, onPageChange, total }: PaginationProps) {
  if (totalPages <= 1) return null;
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  return (
    <nav className="ptn-pagination" aria-label="ترقيم الصفحات">
      <button
        type="button"
        className="ptn-pagination__btn"
        disabled={prevDisabled}
        onClick={() => onPageChange(page - 1)}
        aria-label="الصفحة السابقة"
      >
        <ChevronRight size={16} aria-hidden="true" className="ptn-pagination__chevron" />
      </button>
      <span className="ptn-pagination__status">
        صفحة {page} من {totalPages}
        {typeof total === 'number' ? ` — ${total}` : ''}
      </span>
      <button
        type="button"
        className="ptn-pagination__btn"
        disabled={nextDisabled}
        onClick={() => onPageChange(page + 1)}
        aria-label="الصفحة التالية"
      >
        <ChevronLeft size={16} aria-hidden="true" className="ptn-pagination__chevron" />
      </button>
    </nav>
  );
}
