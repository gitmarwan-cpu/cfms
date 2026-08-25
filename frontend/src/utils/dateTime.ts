/**
 * Shared date/time formatting for the CFMS frontend.
 *
 * The application UI is Arabic-first and renders timestamps in the browser's
 * local timezone. Existing pages previously used inline
 * `new Date(...).toLocaleString('ar')`; this module centralizes that single
 * convention so audit and event timestamps render identically across the
 * administration UI.
 */

type DateTimeValue = string | number | Date | null | undefined;

const APP_LOCALE = 'ar';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

const toValidDate = (value: DateTimeValue): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Formats a timestamp as a short, human-readable date. */
export function formatDate(value: DateTimeValue): string {
  const date = toValidDate(value);
  return date ? date.toLocaleDateString(APP_LOCALE, DATE_OPTIONS) : '—';
}

/** Formats a timestamp as date + time (used for audit created/updated dates). */
export function formatDateTime(value: DateTimeValue): string {
  const date = toValidDate(value);
  return date ? date.toLocaleString(APP_LOCALE, { ...DATE_OPTIONS, ...TIME_OPTIONS }) : '—';
}