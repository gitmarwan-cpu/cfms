import { Menu, Command as CommandIcon } from 'lucide-react';
import OrganizationSwitcher from '../admin/OrganizationSwitcher';
import NotificationCenter from '../admin/NotificationCenter';
import UserMenu from './UserMenu';

interface HeaderProps {
  onMenuClick: () => void;
  onOpenCommand: () => void;
}

/** Application header: mobile menu, org context, command trigger,
 *  notifications, account menu. Kept deliberately uncluttered. */
export default function Header({ onMenuClick, onOpenCommand }: HeaderProps) {
  return (
    <header className="header">
      <button type="button" className="header__menu-btn" onClick={onMenuClick} aria-label="فتح قائمة التنقل">
        <Menu size={20} />
      </button>
      <div className="header__org">
        <OrganizationSwitcher />
      </div>
      <div className="header__spacer" />
      <button
        type="button"
        className="header__command-btn"
        onClick={onOpenCommand}
        aria-label="بحث سريع وانتقال (Control K)"
      >
        <CommandIcon size={15} aria-hidden="true" />
        <span className="header__command-label">بحث سريع</span>
        <kbd className="header__kbd" dir="ltr" aria-hidden="true">Ctrl K</kbd>
      </button>
      <NotificationCenter />
      <UserMenu />
    </header>
  );
}
