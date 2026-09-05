import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { NAV_GROUPS } from './navConfig';
import { cn } from '../../utils/cn';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

/** Mobile navigation drawer (RTL: slides from the inline-start edge). */
export default function MobileNav({ open, onClose }: MobileNavProps) {
  const location = useLocation();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="mnav-overlay" />
        <Dialog.Content className="mnav-panel" aria-describedby={undefined}>
          <div className="mnav-head">
            <Dialog.Title className="mnav-title">القائمة</Dialog.Title>
            <Dialog.Close className="mnav-close" aria-label="إغلاق القائمة">
              <X size={20} />
            </Dialog.Close>
          </div>
          <nav className="mnav-nav" aria-label="تنقل الجوال">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="mnav-group-label">{group.label}</div>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) => cn('mnav-link', isActive && 'mnav-link--active')}
                  >
                    <span className="sidebar__link-icon" aria-hidden="true">
                      <item.icon size={18} />
                    </span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
