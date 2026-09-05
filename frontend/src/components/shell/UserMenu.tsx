import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/** Header account menu: identity summary + logout (Radix dropdown a11y). */
export default function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = (user.fullName ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="usermenu-trigger" aria-label="قائمة الحساب">
        <span className="usermenu-avatar" aria-hidden="true">{initials}</span>
        <span className="usermenu-name">{user.fullName}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="usermenu-content"
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          avoidCollisions
        >
          <div className="usermenu-meta">
            <div className="usermenu-meta-name">{user.fullName}</div>
            <div className="usermenu-meta-email" dir="ltr">{user.email}</div>
          </div>
          <DropdownMenu.Separator className="usermenu-sep" />
          <DropdownMenu.Item className="usermenu-item" onSelect={() => logout()}>
            <LogOut size={16} aria-hidden="true" />
            تسجيل الخروج
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
