import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

type Tone = 'brand' | 'aqua' | 'success' | 'warning' | 'danger' | 'critical' | 'neutral';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-500/20',
  aqua: 'bg-aqua-50 text-aqua-700 ring-aqua-500/20',
  success: 'bg-success-100 text-success-700 ring-success-500/20',
  warning: 'bg-warning-100 text-warning-700 ring-warning-500/25',
  danger: 'bg-danger-100 text-danger-700 ring-danger-500/20',
  critical: 'bg-critical-100 text-critical-700 ring-critical-500/25',
  neutral: 'bg-ink-100 text-ink-600 ring-ink-400/20',
};

export function Badge({
  children,
  tone = 'neutral',
  solid = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  /** Tasarımdaki dolu yeşil "Yeni" rozeti gibi. */
  solid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md px-2 ring-1 ring-inset',
        'text-xs font-medium whitespace-nowrap',
        solid ? 'bg-success-500 text-white ring-transparent' : TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Hazır token sınıfı taşıyan rozet — risk seviyesi ve SLA durumu gibi
 * rengi `shared/lib/risk` sözlüğünden gelen yerlerde kullanılır.
 */
export function ToneBadge({
  children,
  className,
  toneClass,
}: {
  children: ReactNode;
  /** `riskTone(...).chip` ya da `SLA_TONE[...].chip` */
  toneClass: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md px-2 ring-1 ring-inset ring-current/15',
        'text-xs font-medium whitespace-nowrap',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}
