import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { NAV_GROUPS } from './navConfig';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Ctrl/Cmd + K command palette. v1 scope: page navigation only —
 *  entity search requires query-param support on the target pages and
 *  is deliberately deferred rather than invented. */
export default function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate();

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
      <Command.Input placeholder="انتقل إلى صفحة…" />
      <Command.List>
        <Command.Empty>لا توجد نتائج</Command.Empty>
        {NAV_GROUPS.map((group) => (
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
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
