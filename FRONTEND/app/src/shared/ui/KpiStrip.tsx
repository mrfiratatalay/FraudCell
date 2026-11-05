import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface Kpi {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Text colour class for the value, e.g. when a count needs attention. */
  tone?: string;
}

/** A row of headline numbers in one panel, separated by hairlines. */
export function KpiStrip({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <dl
      className={cn(
        'surface-panel grid grid-cols-2 overflow-hidden sm:grid-cols-3 max-sm:[&>div:last-child:nth-child(odd)]:col-span-2',
        items.length >= 5 ? 'lg:grid-cols-5' : items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="-mr-px -mb-px border-r border-b border-line px-5 py-4">
          <dt className="text-[13px] text-ink-500">{item.label}</dt>
          <dd className={cn('mt-1.5 text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-ink-900 tabular', item.tone)}>
            {item.value}
          </dd>
          {item.hint ? <dd className="mt-1.5 text-xs text-ink-500">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
