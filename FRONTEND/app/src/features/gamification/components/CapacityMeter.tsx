import type { AnalystScoreResponse } from '@/shared/api/contract-pending';
import { StatTile } from '@/shared/ui';
import { formatPercent } from '@/shared/lib/format';

export function CapacityMeter({ score }: { score: AnalystScoreResponse }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Toplam puan" value={score.totalPoints} />
      <StatTile
        label="Aktif vaka"
        value={`${score.activeCases} / 10`}
        hint={`Kapasite: ${formatPercent(score.capacity)}`}
      />
      <StatTile label="Çözülen vaka" value={score.resolvedCases} />
      <StatTile label="Doğruluk" value={formatPercent(score.accuracy)} />
    </div>
  );
}
