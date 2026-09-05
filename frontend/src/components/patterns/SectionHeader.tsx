import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** 2 = section (h2), 3 = subsection/card (h3). Keeps heading hierarchy predictable. */
  level?: 2 | 3;
}

/** Section/card-level heading with optional trailing actions. */
export default function SectionHeader({ title, description, actions, level = 2 }: SectionHeaderProps) {
  const TitleTag = level === 2 ? 'h2' : 'h3';
  return (
    <div className={`ptn-section-header ptn-section-header--l${level}`}>
      <div className="ptn-section-header__text">
        <TitleTag className="ptn-section-header__title">{title}</TitleTag>
        {description && <p className="ptn-section-header__desc">{description}</p>}
      </div>
      {actions && <div className="ptn-section-header__actions">{actions}</div>}
    </div>
  );
}
