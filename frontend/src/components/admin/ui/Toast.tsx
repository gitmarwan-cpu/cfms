import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import '../../../styles/admin-foundation.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastOptions {
  /** Auto-dismiss delay in milliseconds (default 5000; errors 6500). */
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;
const ERROR_DURATION_MS = 6500;

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: <Check size={15} aria-hidden="true" />,
  error: <X size={15} aria-hidden="true" />,
  warning: <TriangleAlert size={15} aria-hidden="true" />,
  info: <Info size={15} aria-hidden="true" />,
};

/**
 * Lightweight internal toast system (no third-party dependency).
 * - success / error / warning / info variants, RTL-friendly.
 * - Auto-dismiss + manual dismissal, multiple simultaneous messages.
 * - Duplicate spam guard: an identical type+message currently on screen is ignored.
 * - Accessibility: aria-live viewport; errors are announced assertively.
 * Usage: const { showToast } = useToast(); showToast('success', 'تم الحفظ');
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const activeKeys = useRef(new Set<string>());
  const nextId = useRef(1);

  const remove = useCallback((id: number, key: string) => {
    activeKeys.current.delete(key);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions) => {
      const key = `${type}:${message}`;
      if (activeKeys.current.has(key)) return; // duplicate spam guard
      const id = nextId.current;
      nextId.current += 1;
      activeKeys.current.add(key);
      setToasts((current) => [...current, { id, type, message }]);
      const durationMs = options?.durationMs ?? (type === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);
      window.setTimeout(() => remove(id, key), durationMs);
    },
    [remove]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="admin-toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`admin-toast admin-toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span className="admin-toast__icon" aria-hidden="true">{TOAST_ICONS[toast.type]}</span>
            <p className="admin-toast__message">{toast.message}</p>
            <button
              type="button"
              className="admin-toast__close"
              onClick={() => remove(toast.id, `${toast.type}:${toast.message}`)}
              aria-label="إغلاق التنبيه"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};