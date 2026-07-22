import type { DashboardSummary } from '@/shared/api/contract-pending';
import { StatTile } from '@/shared/ui';
import { formatNumber } from '@/shared/lib/format';

/** DESIGN.MD kural 2: bu sayılar backend aggregate'inden gelir, burada hesaplanmaz. */
export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="Açık vaka" value={formatNumber(summary.openCases)} />
      <StatTile label="Kritik vaka" value={formatNumber(summary.criticalCases)} tone="text-critical-700" />
      <StatTile label="SLA aşımı" value={formatNumber(summary.slaBreaches)} tone="text-danger-500" />
      <StatTile label="Ort. karar süresi" value={`${summary.avgDecisionMinutes} dk`} />
      <StatTile label="Bugün kararlanan" value={formatNumber(summary.decidedToday)} />
      <StatTile label="Bugün bloklanan" value={formatNumber(summary.blockedToday)} tone="text-danger-500" />
    </div>
  );
}
