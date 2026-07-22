import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LogoMark } from '@/shared/ui/Logo';

/**
 * Kimlik ekranlarının ortak kabuğu — tasarımdaki gradient splash yüzeyi.
 *
 * Geri düğmesi router geçmişi yerine `onBack` alır: OTP akışı tek route içinde
 * adım adım ilerliyor, dolayısıyla "geri" çoğu zaman önceki ADIMA dönmek
 * demek, önceki sayfaya değil.
 */
export function AuthShell({
  title,
  description,
  onBack,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  /** Sayfanın en altına sabitlenen alan — birincil eylem butonu. */
  footer?: ReactNode;
}) {
  return (
    <div className="gradient-splash flex min-h-dvh flex-col px-6 safe-top safe-bottom">
      <div className="flex h-14 shrink-0 items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Geri"
            className="-ml-2 rounded-full p-2 text-white transition-colors hover:bg-white/15"
          >
            <ArrowLeft className="size-6" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex flex-col items-center pt-6">
          <LogoMark className="size-16 text-white" />
          <h1 className="mt-4 text-center text-2xl font-bold text-white">{title}</h1>
          {description && (
            <div className="mt-2 max-w-xs text-center text-[15px] leading-relaxed text-white/80">
              {description}
            </div>
          )}
        </div>

        <div className="mx-auto mt-8 w-full max-w-sm">{children}</div>
      </div>

      {footer && <div className="mx-auto w-full max-w-sm pb-8">{footer}</div>}
    </div>
  );
}

/** Gradient üzerinde duran birincil buton — beyaz zemin, koyu mavi metin. */
export function AuthSubmit({
  children,
  loading = false,
  disabled = false,
  onClick,
  type = 'submit',
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'h-14 w-full rounded-pill text-[17px] font-semibold shadow-raised transition-colors',
        'bg-white text-brand-800 hover:bg-brand-50 active:bg-brand-100',
        // Devre dışı hâli tasarımda soluk gri dolgu.
        'disabled:pointer-events-none disabled:bg-white/25 disabled:text-white/50 disabled:shadow-none',
      )}
    >
      {loading ? 'Lütfen bekle…' : children}
    </button>
  );
}
