import { cn } from '@/shared/lib/cn';
import type { ReasonCodeResponse } from '@/shared/api/contract';
import type { ReasonImpact } from '@/shared/api/enums';

/**
 * AI reason code listesi — kararın gerekçeleri.
 *
 * bunlar model açıklaması DEĞİL, rule/feature katmanından gelen
 * gerekçelerdir. Etki (impact) rengi ile ağırlığı gösterilir; hem müşteri işlem
 * detayında hem analist vaka tezgâhında aynı görünür.
 */

const IMPACT: Record<ReasonImpact, { label: string; dot: string; chip: string; weight: number }> = {
  HIGH: { label: 'Yüksek etki', dot: 'bg-danger-500', chip: 'bg-danger-100 text-danger-700', weight: 100 },
  MEDIUM: { label: 'Orta etki', dot: 'bg-warning-500', chip: 'bg-warning-100 text-warning-700', weight: 62 },
  LOW: { label: 'Düşük etki', dot: 'bg-brand-400', chip: 'bg-brand-100 text-brand-700', weight: 32 },
};

const ORDER: Record<ReasonImpact, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function ReasonCodeList({
  reasons,
  className,
}: {
  reasons: ReasonCodeResponse[];
  className?: string;
}) {
  if (reasons.length === 0) {
    return <p className={cn('text-sm text-ink-400', className)}>Gerekçe kaydı yok.</p>;
  }

  const sorted = [...reasons].sort((a, b) => ORDER[a.impact] - ORDER[b.impact]);

  return (
    <ul className={cn('divide-y divide-line overflow-hidden rounded-lg ring-1 ring-line', className)}>
      {sorted.map((reason) => {
        const spec = IMPACT[reason.impact];
        return (
          <li key={reason.code} className="flex items-center justify-between gap-3 bg-surface px-3.5 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={cn('size-1.5 shrink-0 rounded-full', spec.dot)} aria-hidden />
              <span className="min-w-0 truncate text-sm text-ink-800">{reason.label}</span>
            </span>
            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium', spec.chip)}>{spec.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
