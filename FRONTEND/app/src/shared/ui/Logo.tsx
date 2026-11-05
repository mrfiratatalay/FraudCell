import { cn } from '@/shared/lib/cn';

/** Product mark: a shield with a pulse line — monitoring that never sleeps. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} role="img" aria-label="FraudCell">
      <rect width="32" height="32" rx="8" className="fill-night-900" />
      <path
        d="M16 5.5l8.5 3.4v6.6c0 5.2-3.6 9.5-8.5 11-4.9-1.5-8.5-5.8-8.5-11V8.9z"
        fill="none"
        stroke="#7c87f7"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 16.2h2.6l1.6-3.6 2.4 7 1.5-3.4h1.9"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoWordmark({
  className,
  tone = 'brand',
}: {
  className?: string;
  tone?: 'brand' | 'white';
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn('size-8', tone === 'white' && 'ring-1 ring-white/12 rounded-lg')} />
      <span
        className={cn(
          'text-[17px] font-semibold tracking-[-0.03em]',
          tone === 'white' ? 'text-white' : 'text-ink-900',
        )}
      >
        Fraud<span className={tone === 'white' ? 'text-brand-300' : 'text-brand-600'}>Cell</span>
      </span>
    </span>
  );
}
