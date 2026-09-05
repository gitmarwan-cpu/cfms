import { useMemo, useState, type ReactNode } from 'react';
import { DataState } from '../AdminUi';

export interface DataTableColumn<T> {
  /** Unique column key; also the default client-side sort field. */
  key: string;
  header: string;
  /** Optional custom cell renderer; defaults to String(row[key]). */
  render?: (row: T) => ReactNode;
  /** Optional raw value used for sorting (defaults to the rendered key value). */
  sortValue?: (row: T) => string | number;
  /** Enable the interactive sort header for this column. */
  sortable?: boolean;
  /** Optional inline width (any CSS value). */
  width?: string;
}

export interface DataTablePagination {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type SortDirection = 'asc' | 'desc';

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  pagination?: DataTablePagination | null;
  /** Trailing actions column (edit/delete/… buttons per row). */
  rowActions?: (row: T) => ReactNode;
  actionsHeader?: string;
  /** Optional initial client-side sort; server-side sorting can be layered later. */
  initialSort?: { key: string; direction: SortDirection };
}

const compareValues = (a: string | number, b: string | number, direction: SortDirection): number => {
  let result: number;
  if (typeof a === 'number' && typeof b === 'number') {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b), 'ar');
  }
  return direction === 'asc' ? result : -result;
};

/**
 * Reusable enterprise data table foundation (RTL, accessible, responsive).
 * Deliberately small: columns + data + loading/error/empty states via
 * DataState, optional client-side sorting, optional pagination, optional row
 * actions. Server-side pagination/sorting can be layered through the same
 * props without changing the contract.
 */
export default function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  error = '',
  emptyMessage = 'لا توجد بيانات لعرضها حالياً.',
  onRetry,
  pagination = null,
  rowActions,
  actionsHeader = 'إجراءات',
  initialSort,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(initialSort ?? null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column) return data;
    const getSortValue = (row: T): string | number =>
      column.sortValue ? column.sortValue(row) : String((row as Record<string, unknown>)[column.key] ?? '');
    return [...data].sort((a, b) => compareValues(getSortValue(a), getSortValue(b), sort.direction));
  }, [data, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const allColumns: DataTableColumn<T>[] = rowActions
    ? [...columns, { key: '__actions', header: actionsHeader, render: rowActions }]
    : columns;

  return (
    <DataState loading={loading} error={error} empty={!loading && !error && data.length === 0} onRetry={onRetry ?? (() => undefined)}>
      <div className="card admin-table-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {allColumns.map((column) => {
                  const isSorted = sort?.key === column.key;
                  const ariaSort = isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined;
                  return (
                    <th
                      key={column.key}
                      style={column.width ? { width: column.width } : undefined}
                      aria-sort={ariaSort}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          className="admin-table__sort-button"
                          onClick={() => toggleSort(column.key)}
                          aria-label={`ترتيب حسب ${column.header}`}
                        >
                          {column.header}
                          <span aria-hidden="true">{isSorted ? (sort?.direction === 'asc' ? '▴' : '▾') : '↕'}</span>
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row) => (
                <tr key={rowKey(row)}>
                  {allColumns.map((column) => (
                    <td key={column.key}>
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="admin-pagination">
            <button
              type="button"
              className="btn admin-pagination__btn"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              السابق
            </button>
            <span className="admin-pagination__info">
              صفحة {pagination.page} من {pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn admin-pagination__btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </DataState>
  );
}