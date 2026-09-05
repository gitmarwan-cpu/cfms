import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CircleDashed,
  CircleStop,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Semantic status tones. Status is NEVER communicated by color alone —
 * every badge renders an icon + text so state survives color-blindness
 * and grayscale rendering.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'verified';

const TONE_META: Record<StatusTone, { icon: LucideIcon; label: string }> = {
  success: { icon: BadgeCheck, label: 'نشط' },
  warning: { icon: AlertTriangle, label: 'تحذير' },
  danger: { icon: CircleStop, label: 'موقوف' },
  info: { icon: Info, label: 'معلومة' },
  neutral: { icon: CircleDashed, label: 'غير محدد' },
  verified: { icon: BadgeCheck, label: 'موثّق' },
};

export interface StatusBadgeProps {
  tone: StatusTone;
  /** Visible text; the semantic meaning is carried by icon + text together. */
  children: ReactNode;
  /** Override the default tone icon when a domain-specific glyph fits better. */
  icon?: LucideIcon;
  /** Hide the default icon (only when the text alone is unambiguous). */
  noIcon?: boolean;
  className?: string;
}

export function StatusBadge({ tone, children, icon, noIcon = false, className }: StatusBadgeProps) {
  const Icon = icon ?? TONE_META[tone].icon;
  return (
    <span className={cn('ui-badge', `ui-badge--${tone}`, className)}>
      {!noIcon && <Icon size={13} aria-hidden="true" className="ui-badge__icon" />}
      <span>{children}</span>
    </span>
  );
}
