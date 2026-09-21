import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { getVisibleNavGroups } from './navConfig';
import { useAuth } from '../../context/AuthContext';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ctrl/Cmd + K command palette. v1 scope: page navigation only —
 *  entity search requires query-param support on the target pages and
 *  is deliberately deferred rather than invented. */
export default function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate();

  const { user } = useAuth();
  const visibleGroups = getVisibleNavGroups(user);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="قائمة الأوامر"
      loop
    >
      {/* Search row: icon + input + ESC — positioned above [cmdk-list] so the
          scrollbar never reaches it, matching the shell.css layout contract. */}
      <div className="cmdk-search">
        <span className="cmdk-search__icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <Command.Input
          className="cmdk-search__input"
          placeholder="انتقل إلى صفحة…"
        />
        <button
          type="button"
          className="cmdk-esc"
          aria-label="إغلاق قائمة الأوامر"
          onClick={() => onOpenChange(false)}
        >
          ESC
        </button>
      </div>
      <Command.List>
        <Command.Empty>لا توجد نتائج</Command.Empty>
        {visibleGroups.map((group) => (
          <Command.Group key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <Command.Item
                key={item.to}
                value={`${item.label} ${item.to}`}
                onSelect={() => {
                  onOpenChange(false);
                  navigate(item.to);
                }}
              >
                <span className="sidebar__link-icon" aria-hidden="true">
                  <item.icon size={16} />
                </span>
                <span className="cmdk-item__label">{item.label}</span>
                <span className="cmdk-item__badge" aria-hidden="true">↵</span>
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
