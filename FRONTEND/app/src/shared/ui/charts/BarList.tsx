import { cn } from '@/shared/lib/cn';
import { formatNumber } from '@/shared/lib/format';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  /** İkincil bilgi — örn. doğruluk oranı. */
  meta?: string;
}

/**
 * Yatay oranlı çubuk listesi — kategori kırılımları için (fraud tipi, aksiyon).
 *
 * Recharts değil, saf div: küçük veri kümelerinde daha okunur ve etiket
 * kırpılmaz. En büyük değere göre normalize edilir.
 */
export function BarList({
  data,
  emptyLabel = 'Veri yok',
  className,
}: {
  data: BarItem[];
  emptyLabel?: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-500">{emptyLabel}</p>;
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {data.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-700">{item.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              {item.meta && <span className="text-xs text-ink-500">{item.meta}</span>}
              <span className="font-medium tabular text-ink-900">{formatNumber(item.value)}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(3, (item.value / max) * 100)}%`,
                backgroundColor: item.color ?? 'var(--color-brand-600)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
