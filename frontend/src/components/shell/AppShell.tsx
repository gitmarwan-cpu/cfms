import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DirectionProvider } from '@radix-ui/react-direction';
import { cn } from '../../utils/cn';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import CommandMenu from './CommandMenu';

const COLLAPSE_KEY = 'cfms.sidebar.collapsed';

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeCollapsed = (value: boolean): void => {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable — collapse state simply is not persisted */
  }
};

/** Admin application shell: skip-link, sidebar, sticky header, mobile
 *  drawer and the Ctrl/Cmd+K command menu. RTL declared at the Radix
 *  DirectionProvider level so every primitive positions correctly. */
export default function AppShell() {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      writeCollapsed(next);
      return next;
    });
  }, []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  const setCommand = useCallback((open: boolean) => setCommandOpen(open), []);

  return (
    <DirectionProvider dir="rtl">
      <a href="#main-content" className="skip-link">تخطَّ إلى المحتوى</a>
      <div className={cn('app-shell', collapsed && 'app-shell--collapsed')}>
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <div className="app-shell__body">
          <Header onMenuClick={openMobile} onOpenCommand={openCommand} />
          <main id="main-content" className="app-shell__main">
            <Outlet />
          </main>
        </div>
        <MobileNav open={mobileOpen} onClose={closeMobile} />
        <CommandMenu open={commandOpen} onOpenChange={setCommand} />
      </div>
    </DirectionProvider>
  );
}
