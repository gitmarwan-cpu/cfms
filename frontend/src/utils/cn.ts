/**
 * Minimal classname joiner (clsx-style) — avoids an extra dependency for a
 * three-line utility. Falsy values (false/undefined/null/'') are skipped so
 * callers can do conditional classes: cn('btn', isActive && 'btn--active').
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
