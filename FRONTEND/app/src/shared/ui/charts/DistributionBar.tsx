import { cn } from '@/shared/lib/cn';

export interface DistributionItem {
  label: string;
  value: number;
  color: string;
}

/**
 * Parts of one whole as a single segmented bar plus a legend with counts and
 * shares. Reads faster than a donut and fits a narrow column.
 */
export function DistributionBar({
  data,
  emptyLabel = 'Veri yok',
  className,
}: {
  data: DistributionItem[];
  emptyLabel?: string;
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <p className="py-4 text-sm text-ink-500">{emptyLabel}</p>;

  return (
    <div className={className}>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(', ')}>
        {data
          .filter((item) => item.value > 0)
          .map((item) => (
            <span key={item.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }} />
          ))}
      </div>
      <ul className="mt-4 space-y-2">
        {data.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[13px]">
            <span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} aria-hidden />
            <span className="flex-1 text-ink-700">{item.label}</span>
            <span className="font-medium text-ink-900 tabular">{item.value}</span>
            <span className={cn('w-10 text-right text-xs text-ink-500 tabular')}>%{Math.round((item.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
