import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/**
 * Radix Dialog üzerine kurulu iki yüzey:
 *   - `Sheet`  → mobilde alttan açılan panel (tasarımdaki bottom sheet)
 *   - `Modal`  → masaüstünde ortalanmış diyalog (karar onayı, override formu)
 *
 * shadcn CLI'ın değişken varsayılanına güvenmek
 * yerine Radix doğrudan ve sürümü sabitlenmiş olarak kullanılır.
 *
 * Radix odak tuzağı, ESC ile kapatma, scroll kilidi ve `aria-modal`ı kendisi
 * yönetir; burada yalnızca görsel katman var.
 */

const overlayClass = cn(
  'fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]',
  'data-[state=open]:animate-fade-in',
);

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Ekran okuyucuya başlığın altında okunan açıklama. */
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto',
            'rounded-t-sheet border border-line bg-surface p-5 shadow-overlay safe-bottom sm:p-6',
            'data-[state=open]:animate-slide-up',
            // Masaüstünde tam genişlik yerine ortalanmış dar panel.
            'sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:w-full sm:max-w-lg',
            'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card',
          )}
        >
          {/* Mobil sürükleme tutamağı — masaüstünde gizli. */}
          <span
            aria-hidden
            className="mx-auto mb-4 block h-1 w-10 rounded-full bg-ink-200 sm:hidden"
          />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-h2 text-ink-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-ink-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Kapat"
              className="-mr-1 shrink-0 rounded-full p-1.5 text-ink-400 transition-colors hover:bg-ink-100"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="mt-4">{children}</div>

          {footer && <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Onay diyaloğu.
 *
 * Approve/block gibi geri alınamaz işlemler kural gereği optimistic
 * yapılmaz; `loading` backend cevabı beklenirken true kalır ve buton kilitlenir.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Vazgeç',
  onConfirm,
  loading = false,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description ? { description } : {})}
      footer={
        <>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-control px-4',
              'text-sm font-semibold transition-colors',
              'disabled:pointer-events-none disabled:bg-ink-100 disabled:text-ink-400',
              destructive ? 'bg-critical-600 text-white hover:bg-critical-700' : 'bg-tc-500 text-night-900 hover:bg-tc-400',
            )}
          >
            {loading ? 'Gönderiliyor…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-control px-4',
              'border border-line text-sm font-medium text-ink-700',
              'transition-colors hover:bg-ink-100 disabled:pointer-events-none',
            )}
          >
            {cancelLabel}
          </button>
        </>
      }
    >
      {children}
    </Sheet>
  );
}
