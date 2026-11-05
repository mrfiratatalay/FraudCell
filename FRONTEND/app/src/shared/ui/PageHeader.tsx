import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface Breadcrumb {
  label: string;
  to?: string;
}

/**
 * Console page header — the shared top of every operations screen.
 *
 * Önceden her sayfa kendi `<header><h1>` bloğunu yazıyordu; başlık boyutu ve
 * boşluğu ekrandan ekrana kayıyordu. Burada tek yerde toplanır: başlık, açıklama,
 * kırıntı yolu ve sağ aksiyon slotu. `text-h1` token'ı ölçeği sabitler.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Kırıntı yolu" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-caption text-ink-500">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                  {crumb.to && !last ? (
                    <Link to={crumb.to} className="transition-colors hover:text-ink-900">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(last && 'font-medium text-ink-700')}>{crumb.label}</span>
                  )}
                  {!last && <ChevronRight className="size-3.5 text-ink-400" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 text-ink-900 sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-body text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
