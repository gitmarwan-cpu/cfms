import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Page title (rendered as the page's h1). */
  title: string;
  /** Optional one-line supporting description. */
  description?: string;
  /** Optional action area (buttons) aligned to the inline-end edge. */
  actions?: ReactNode;
}

/**
 * Page-level header pattern: page title + optional description and an
 * optional action slot. RTL-first via logical properties (components.css).
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="ptn-page-header">
      <div className="ptn-page-header__titles">
        <h1 className="ptn-page-header__title">{title}</h1>
        {description ? <p className="ptn-page-header__desc">{description}</p> : null}
      </div>
      {actions ? <div className="ptn-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
