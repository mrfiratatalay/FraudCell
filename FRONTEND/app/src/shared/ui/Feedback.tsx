import type { ReactNode } from 'react';
import { AlertCircle, Info, CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { messageFor } from '@/shared/api/errors';
import { Button } from './Button';
import { Illustration, type IllustrationName } from './Illustration';

/**
 * query kullanan her ekran loading/error/empty durumlarını
 * İLK implementasyondan itibaren taşır. Bu dosya o üç durumun ortak karşılığı.
 */

/* ------------------------------------------------------------- Skeleton -- */

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'animate-shimmer rounded-md bg-ink-100',
        'bg-[linear-gradient(90deg,var(--color-ink-100)_25%,var(--color-ink-200)_50%,var(--color-ink-100)_75%)]',
        'bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

/** Liste yüklenirken gösterilen kart iskeletleri. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Yükleniyor">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="surface-card flex items-center gap-3 p-4">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- EmptyState -- */

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  /** İllüstrasyon adı — `icon`'a tercih edilir; daha sıcak boş durumlar için. */
  illustration?: IllustrationName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {illustration ? (
        <Illustration name={illustration} className="mb-5" />
      ) : icon ? (
        <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-brand-100 text-brand-600 [&>svg]:size-8">
          {icon}
        </span>
      ) : null}
      <p className="text-[17px] font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- ErrorState -- */

/**
 * Hata durumu. Mesajı `messageFor` üretir; ekranlar kendi metnini uydurmaz.
 * `traceId` varsa gösterilir — jüri demosunda log ile eşleştirmeyi kolaylaştırır.
 */
export function ErrorState({
  error,
  onRetry,
  title = 'Bir şeyler ters gitti',
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const traceId =
    error && typeof error === 'object' && 'traceId' in error
      ? ((error as { traceId: string | null }).traceId ?? null)
      : null;

  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
    >
      <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-danger-100 text-danger-500">
        <AlertCircle className="size-8" />
      </span>
      <p className="text-[17px] font-semibold text-ink-900">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-ink-500">{messageFor(error)}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-6"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="size-4" />}
        >
          Tekrar dene
        </Button>
      )}
      {traceId && <p className="mt-4 font-mono text-[11px] text-ink-400">İz kodu: {traceId}</p>}
    </div>
  );
}

/* --------------------------------------------------------------- Banner -- */

type BannerTone = 'info' | 'success' | 'warning' | 'danger';

const BANNER: Record<BannerTone, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: 'bg-brand-100 text-brand-800',
    icon: <Info className="size-5 shrink-0 text-brand-600" />,
  },
  success: {
    wrap: 'bg-success-100 text-success-700',
    icon: <CheckCircle2 className="size-5 shrink-0 text-success-500" />,
  },
  warning: {
    wrap: 'bg-warning-100 text-warning-700',
    icon: <TriangleAlert className="size-5 shrink-0 text-warning-500" />,
  },
  danger: {
    wrap: 'bg-danger-100 text-danger-700',
    icon: <AlertCircle className="size-5 shrink-0 text-danger-500" />,
  },
};

/**
 * Bilgi şeridi — servis kapalı uyarıları ve 409 çakışma mesajları burada
 * gösterilir.
 */
export function Banner({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: BannerTone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const spec = BANNER[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-card px-4 py-3 text-sm leading-relaxed',
        spec.wrap,
        className,
      )}
    >
      {spec.icon}
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
