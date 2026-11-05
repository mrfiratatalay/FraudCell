import { cn } from '@/shared/lib/cn';
import { DISPLAY_RISK_LABEL, riskTone, UNKNOWN_RISK } from '@/shared/lib/risk';
import type { RiskLevel } from '@/shared/api/enums';
import { formatScore } from '@/shared/lib/format';

const ORDER = ['DUSUK', 'ORTA', 'YUKSEK', 'KRITIK'] as const;

/**
 * Compact risk read-out for tables: the score, the level name, and a
 * four-step meter filled up to the level. Colour is never the only signal.
 */
export function RiskScore({
  level,
  score,
  className,
}: {
  level: RiskLevel | null | undefined;
  score: number | null | undefined;
  className?: string;
}) {
  const tone = riskTone(level ?? UNKNOWN_RISK);
  const filled = level ? ORDER.indexOf(level) + 1 : 0;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex gap-[3px]" aria-hidden>
        {ORDER.map((step, index) => (
          <span key={step} className={cn('h-3.5 w-1 rounded-[1px]', index < filled ? tone.bar : 'bg-ink-200')} />
        ))}
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn('text-[13px] font-medium', tone.text)}>{DISPLAY_RISK_LABEL[level ?? UNKNOWN_RISK]}</span>
        <span className="font-mono text-[11px] text-ink-500 tabular">{score == null ? '—' : formatScore(score)}</span>
      </span>
    </span>
  );
}

/**
 * Score on the 0–1 line with the screening thresholds drawn in
 * (<0,40 ONAY · 0,40–0,90 INCELEME · >0,90 BLOK), so the reader sees why the
 * transaction landed where it did.
 */
export function RiskMeter({
  level,
  score,
  className,
}: {
  level: RiskLevel | null | undefined;
  score: number | null | undefined;
  className?: string;
}) {
  const tone = riskTone(level ?? UNKNOWN_RISK);
  const pct = score == null ? 0 : Math.min(100, Math.max(0, score * 100));
  return (
    <div className={className}>
      <div className="relative h-2 rounded-full bg-ink-100">
        <div className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700', tone.bar)} style={{ width: `${pct}%` }} />
        <span className="absolute -top-1 -bottom-1 left-[40%] w-px bg-ink-400" aria-hidden />
        <span className="absolute -top-1 -bottom-1 left-[90%] w-px bg-ink-400" aria-hidden />
        {score != null && (
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink-900 shadow"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="relative mt-2 h-4 text-[11px] text-ink-500">
        <span className="absolute left-0">Onay</span>
        <span className="absolute left-[40%] hidden -translate-x-1/2 sm:inline">0,40</span>
        <span className="absolute left-[65%] -translate-x-1/2">İnceleme</span>
        <span className="absolute left-[90%] hidden -translate-x-1/2 sm:inline">0,90</span>
        <span className="absolute right-0">Blok</span>
      </div>
    </div>
  );
}
