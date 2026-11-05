import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, ListChecks } from 'lucide-react';
import {
  getAiCategoryAccuracy,
  getAiDecisionAgreement,
  getAiMetricsOverview,
} from '@/features/ai/api';
import { listCases } from '@/features/cases/api';
import { CaseTable } from '@/features/cases/CaseTable';
import {
  FRAUD_TYPE_LABEL,
  RISK_LEVELS,
  RISK_LEVEL_LABEL,
  SLA_STATUSES,
  SLA_STATUS_LABEL,
} from '@/shared/api/enums';
import type { CaseResponse } from '@/shared/api/contract';
import { queryKeys } from '@/shared/api/query-keys';
import { formatNumber, formatPercent } from '@/shared/lib/format';
import {
  compareSlaUrgency,
  riskTone,
  seriesColor,
  slaComplianceRate,
  SLA_TONE,
} from '@/shared/lib/risk';
import {
  EmptyState,
  ErrorState,
  KpiStrip,
  PageHeader,
  Skeleton,
  SkeletonList,
} from '@/shared/ui';
import { BarList, ChartFrame, DistributionBar } from '@/shared/ui/charts';

const OPEN_EXCLUDED = ['KAPANDI', 'ONAYLANDI', 'BLOKLANDI'];

/** Vaka listesinden risk seviyesi dağılımı — donut dilimleri. */
function riskDistribution(cases: CaseResponse[]) {
  return RISK_LEVELS.map((level) => ({
    label: RISK_LEVEL_LABEL[level],
    value: cases.filter((c) => c.effectiveRisk.riskLevel === level).length,
    color: riskTone(level).chartFill,
  })).filter((slice) => slice.value > 0);
}

/** Açık vakaların SLA durumu dağılımı. */
function slaHealth(cases: CaseResponse[]) {
  return SLA_STATUSES.map((status) => ({
    label: SLA_STATUS_LABEL[status],
    value: cases.filter((c) => c.sla.status === status).length,
    color: SLA_TONE[status].chartFill,
  })).filter((slice) => slice.value > 0);
}

/** Fraud tipine göre açık vaka sayısı — bar list. */
function fraudBreakdown(cases: CaseResponse[]) {
  const counts = new Map<string, number>();
  for (const c of cases) {
    if (!c.effectiveRisk.fraudType) continue;
    counts.set(c.effectiveRisk.fraudType, (counts.get(c.effectiveRisk.fraudType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, value], index) => ({
      label: FRAUD_TYPE_LABEL[type as keyof typeof FRAUD_TYPE_LABEL] ?? type,
      value,
      color: seriesColor(index),
    }))
    .sort((a, b) => b.value - a.value);
}

export function SupervisorDashboardPage() {
  const cases = useQuery({
    queryKey: queryKeys.cases.list({}),
    queryFn: () => listCases({ limit: 100 }),
  });
  const metrics = useQuery({ queryKey: queryKeys.ai.metrics, queryFn: getAiMetricsOverview });
  const categories = useQuery({
    queryKey: queryKeys.ai.categoryAccuracy,
    queryFn: getAiCategoryAccuracy,
  });
  const agreement = useQuery({
    queryKey: queryKeys.ai.decisionAgreement,
    queryFn: getAiDecisionAgreement,
  });

  const items = cases.data?.items ?? [];
  // Case §4.4: SLA'sı aşılmış vakalar panelde en üstte, KRITIK önce.
  const openCases = items
    .filter((item) => !OPEN_EXCLUDED.includes(item.status))
    .sort(compareSlaUrgency);
  const slaCompliance = slaComplianceRate(items);
  const urgentCases = openCases.filter((item) => ['URGENT', 'BREACHED'].includes(item.sla.status));
  const criticalCases = openCases.filter((item) => item.effectiveRisk.riskLevel === 'KRITIK');

  const categoryBars =
    categories.data?.items
      .filter((row) => row.fraudType !== 'UNKNOWN')
      .map((row, index) => ({
        label: FRAUD_TYPE_LABEL[row.fraudType as keyof typeof FRAUD_TYPE_LABEL] ?? row.fraudType,
        value: Math.round((row.precision ?? 0) * 100),
        color: seriesColor(index),
        meta: `${formatNumber(row.sampleCount)} örnek · yakalama ${row.recall == null ? '—' : `%${Math.round(row.recall * 100)}`}`,
      })) ?? [];

  const busy = cases.isPending;

  return (
    <div>
      <PageHeader
        title="Operasyon paneli"
        description="Önce müdahale bekleyenler; sonra yük, SLA ve modelin durumu."
        actions={
          <Link
            to="/supervisor/queue"
            search={{ queueType: 'ALL' }}
            className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-4 text-sm font-medium text-ink-900 shadow-card transition-colors hover:bg-subtle"
          >
            <ListChecks className="size-4" aria-hidden /> Atama kuyruğu
          </Link>
        }
      />

      {cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
      ) : (
        <KpiStrip
          items={[
            { label: 'Açık vaka', value: busy ? <Skeleton className="h-7 w-10" /> : openCases.length },
            {
              label: 'Acil / aşılmış SLA',
              value: busy ? <Skeleton className="h-7 w-10" /> : urgentCases.length,
              tone: urgentCases.length > 0 ? 'text-critical-600' : undefined,
            },
            {
              label: 'SLA uyumu',
              value: busy ? <Skeleton className="h-7 w-14" /> : formatPercent(slaCompliance),
              hint: 'Kararı süresinde verilenler',
            },
            {
              label: 'Kritik risk',
              value: busy ? <Skeleton className="h-7 w-10" /> : criticalCases.length,
              tone: criticalCases.length > 0 ? 'text-critical-600' : undefined,
            },
            {
              label: 'AI–analist uyumu',
              value: agreement.isPending ? <Skeleton className="h-7 w-14" /> : formatPercent(agreement.data?.decisionAgreementRate),
              hint: agreement.data ? `${formatNumber(agreement.data.sampleCount)} karar` : undefined,
            },
          ]}
        />
      )}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="priority-cases-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="priority-cases-title" className="text-h2 text-ink-900">
                Müdahale bekleyenler
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-500">SLA'sı aşılan önce, sonra süresi en az kalan.</p>
            </div>
            <Link to="/supervisor/cases" search={{}} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
              Tüm vakalar <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {busy ? (
            <SkeletonList rows={4} />
          ) : openCases.length === 0 ? (
            <div className="surface-panel">
              <EmptyState illustration="secure" title="Açık vaka yok" description="Yeni vakalar AI skorlamasından sonra buraya düşer." />
            </div>
          ) : (
            <CaseTable items={openCases.slice(0, 8)} to="/supervisor/cases/$caseId" label="Müdahale bekleyen vakalar" />
          )}
        </section>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <ChartFrame title="Risk dağılımı" hint="Açık vakalar">
            {busy ? <Skeleton className="h-24 w-full" /> : <DistributionBar data={riskDistribution(openCases)} emptyLabel="Açık vaka yok" />}
          </ChartFrame>
          <ChartFrame title="SLA durumu" hint="Açık vakaların sayacı">
            {busy ? <Skeleton className="h-24 w-full" /> : <DistributionBar data={slaHealth(openCases)} emptyLabel="Açık vaka yok" />}
          </ChartFrame>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ChartFrame title="Fraud tipi kırılımı" hint="Açık vaka sayısı">
          {busy ? <Skeleton className="h-32 w-full" /> : <BarList data={fraudBreakdown(openCases)} emptyLabel="Açık vakada risk tipi yok" />}
        </ChartFrame>

        <ChartFrame title="Model doğruluğu" hint="Türe göre isabet; yanında yakalama oranı">
          {categories.isPending ? <Skeleton className="h-32 w-full" /> : <BarList data={categoryBars} emptyLabel="Henüz yeterli karar yok" />}
        </ChartFrame>

        <ChartFrame
          title="Aktif model"
          action={
            metrics.data?.modelBundleVersion ? (
              <span className="rounded-md bg-ink-100 px-2 py-1 font-mono text-[11px] text-ink-600">{metrics.data.modelBundleVersion}</span>
            ) : null
          }
        >
          {metrics.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              {[
                ['Tür doğruluğu', formatPercent(metrics.data?.fraudTypeAccuracy)],
                ['Karar uyumu', formatPercent(metrics.data?.decisionAgreementRate)],
                ['Yanlış pozitif', formatPercent(metrics.data?.falsePositiveRate)],
                ['Toplam tahmin', formatNumber(metrics.data?.totalPredictions ?? 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-500">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink-900 tabular">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </ChartFrame>
      </div>
    </div>
  );
}
