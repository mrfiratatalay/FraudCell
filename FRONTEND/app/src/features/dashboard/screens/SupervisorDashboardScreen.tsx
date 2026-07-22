import { ErrorState, SkeletonList } from '@/shared/ui';
import { AiAccuracyCard } from '../components/AiAccuracyCard';
import { CaseStatusPie } from '../components/CaseStatusPie';
import { CaseTrendLine } from '../components/CaseTrendLine';
import { FraudTypeBar } from '../components/FraudTypeBar';
import { RiskLevelBar } from '../components/RiskLevelBar';
import { SummaryCards } from '../components/SummaryCards';
import { useAiMetricsQuery, useDashboardQuery } from '../queries';

export function SupervisorDashboardScreen() {
  const dashboardQuery = useDashboardQuery();
  const aiQuery = useAiMetricsQuery();

  if (dashboardQuery.isLoading) return <SkeletonList rows={4} />;
  if (dashboardQuery.isError) {
    return <ErrorState error={dashboardQuery.error} onRetry={() => void dashboardQuery.refetch()} />;
  }
  if (!dashboardQuery.data) return null;

  const d = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <SummaryCards summary={d.summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CaseStatusPie data={d.byStatus} />
        <RiskLevelBar data={d.byRiskLevel} />
      </div>

      <FraudTypeBar data={d.byFraudType} />
      <CaseTrendLine data={d.trend} />

      {aiQuery.data && <AiAccuracyCard metrics={aiQuery.data} />}
    </div>
  );
}
