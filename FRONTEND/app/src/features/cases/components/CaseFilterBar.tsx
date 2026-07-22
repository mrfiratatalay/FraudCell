import { CASE_STATUS_LABEL, CASE_STATUSES, RISK_LEVEL_LABEL, RISK_LEVELS } from '@/shared/api/enums';
import type { CaseStatus, RiskLevel } from '@/shared/api/enums';
import { cn } from '@/shared/lib/cn';

const selectClass = cn(
  'h-10 rounded-tile border border-ink-200 bg-white px-3 text-sm text-ink-900',
  'focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none',
);

/**
 * Vaka listelerinin filtre çubuğu.
 *
 * Filtreler TanStack Table'ın client-side filtresi DEĞİLDİR — burada seçilen
 * değer route'un `validateSearch`'e bağlı URL search param'ına yazılır ve
 * query buradan backend'e gönderilir (`CaseTable` yalnızca `getCoreRowModel`
 * kullanır, bkz. o dosyanın yorum notu).
 */
export function CaseFilterBar({
  status,
  onStatusChange,
  riskLevel,
  onRiskLevelChange,
}: {
  status?: CaseStatus;
  onStatusChange: (status: CaseStatus | undefined) => void;
  riskLevel?: RiskLevel;
  onRiskLevelChange?: (riskLevel: RiskLevel | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        aria-label="Durum filtresi"
        value={status ?? ''}
        onChange={(e) => onStatusChange(e.target.value ? (e.target.value as CaseStatus) : undefined)}
        className={selectClass}
      >
        <option value="">Tüm durumlar</option>
        {CASE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CASE_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      {onRiskLevelChange && (
        <select
          aria-label="Risk seviyesi filtresi"
          value={riskLevel ?? ''}
          onChange={(e) =>
            onRiskLevelChange(e.target.value ? (e.target.value as RiskLevel) : undefined)
          }
          className={selectClass}
        >
          <option value="">Tüm risk seviyeleri</option>
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {RISK_LEVEL_LABEL[level]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
