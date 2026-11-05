import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { messageFor } from '@/shared/api/errors';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  show: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  /** Yakalanan hatayı `messageFor` ile çevirip gösterir. */
  fromError: (error: unknown, title?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONES: Record<ToastTone, { wrap: string; icon: ReactNode }> = {
  success: {
    wrap: 'border-success-500/30 bg-surface',
    icon: <CheckCircle2 className="size-5 text-success-500" />,
  },
  error: {
    wrap: 'border-danger-500/30 bg-surface',
    icon: <AlertCircle className="size-5 text-danger-500" />,
  },
  warning: {
    wrap: 'border-warning-500/30 bg-surface',
    icon: <TriangleAlert className="size-5 text-warning-500" />,
  },
  info: { wrap: 'border-brand-500/30 bg-surface', icon: <Info className="size-5 text-brand-600" /> },
};

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      warning: (title, description) => show({ tone: 'warning', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
      fromError: (error, title = 'İşlem tamamlanamadı') =>
        show({ tone: 'error', title, description: messageFor(error) }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          // aria-live ile ekran okuyucu bildirimi otomatik okur.
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3',
                'rounded-lg border px-4 py-3 shadow-overlay',
                TONES[toast.tone].wrap,
              )}
            >
              <span className="mt-0.5 shrink-0">{TONES[toast.tone].icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-sm text-ink-500">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Bildirimi kapat"
                className="-mr-1 shrink-0 rounded-full p-1 text-ink-400 transition-colors hover:bg-ink-100"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast, ToastProvider içinde kullanılmalıdır.');
  return context;
}
