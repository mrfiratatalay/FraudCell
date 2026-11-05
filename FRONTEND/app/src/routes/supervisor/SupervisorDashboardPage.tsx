import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Clock3,
  FolderKanban,
  Handshake,
  ListChecks,
} from 'lucide-react';
import {
  getAiCategoryAccuracy,
  getAiDecisionAgreement,
  getAiMetricsOverview,
} from '@/features/ai/api';
import { listCases } from '@/features/cases/api';
import {
  CASE_STATUS_LABEL,
  FRAUD_TYPE_LABEL,
  RISK_LEVELS,
  RISK_LEVEL_LABEL,
  SLA_STATUSES,
  SLA_STATUS_LABEL,
} from '@/shared/api/enums';
import type { CaseResponse } from '@/shared/api/contract';
import { queryKeys } from '@/shared/api/query-keys';
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';
import { riskTone, seriesColor, SLA_TONE } from '@/shared/lib/risk';
import {
  ErrorState,
  PageHeader,
  Skeleton,
  SkeletonCards,
  SkeletonChart,
  SlaCountdown,
  StatTile,
  ToneBadge,
} from '@/shared/ui';
import { BarList, ChartFrame, DonutChart } from '@/shared/ui/charts';

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
  const openCases = items.filter((item) => !OPEN_EXCLUDED.includes(item.status));
  const urgentCases = openCases.filter((item) => ['URGENT', 'BREACHED'].includes(item.sla.status));
  const criticalCases = openCases.filter((item) => item.effectiveRisk.riskLevel === 'KRITIK');

  const categoryBars =
    categories.data?.items
      .filter((row) => row.fraudType !== 'UNKNOWN')
      .map((row, index) => ({
        label: FRAUD_TYPE_LABEL[row.fraudType as keyof typeof FRAUD_TYPE_LABEL] ?? row.fraudType,
        value: Math.round((row.precision ?? 0) * 100),
        color: seriesColor(index),
        meta: `${formatNumber(row.sampleCount)} örnek · yakalama %${Math.round((row.recall ?? 0) * 100)}`,
      })) ?? [];

  return (
    <div>
      <PageHeader
        title="Operasyon kontrol merkezi"
        description="Açık vaka yükünü, SLA sağlığını ve model performansını tek bakışta izle."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/supervisor/queue"
              search={{ queueType: 'QUEUED' }}
              className="inline-flex items-center gap-2 rounded-pill border border-brand-100 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-card transition-colors hover:bg-brand-50"
            >
              <ListChecks className="size-4" /> Atama kuyruğu
            </Link>
            <Link
              to="/supervisor/cases"
              search={{}}
              className="inline-flex items-center gap-2 rounded-pill bg-brand-950 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-800"
            >
              Vakaları aç <ArrowRight className="size-4" />
            </Link>
          </div>
        }
      />

      {/* KPI satırı */}
      {cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
      ) : cases.isPending ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Açık vaka"
            value={openCases.length}
            icon={<FolderKanban className="size-5" />}
          />
          <StatTile
            label="Acil / aşılmış SLA"
            value={urgentCases.length}
            tone="text-danger-600"
            icon={<Clock3 className="size-5" />}
          />
          <StatTile
            label="Kritik risk"
            value={criticalCases.length}
            tone="text-warning-700"
            icon={<AlertTriangle className="size-5" />}
          />
          <StatTile
            label="AI–analist uyumu"
            value={
              agreement.isPending ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                formatPercent(agreement.data?.decisionAgreementRate)
              )
            }
            hint={
              agreement.data ? `${formatNumber(agreement.data.sampleCount)} karar` : 'Uyum oranı'
            }
            icon={<Handshake className="size-5" />}
          />
        </div>
      )}

      {/* Grafikler */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {cases.isPending ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : (
          <>
            <ChartFrame title="Risk dağılımı" hint="Açık vakalar" height={200}>
              <DonutChart data={riskDistribution(openCases)} centerLabel="Açık vaka" />
            </ChartFrame>
            <ChartFrame title="SLA sağlığı" hint="Açık vakaların sayaç durumu" height={200}>
              <DonutChart data={slaHealth(openCases)} centerLabel="Açık vaka" />
            </ChartFrame>
          </>
        )}

        <ChartFrame title="Fraud tipi kırılımı" hint="Açık vaka sayısı" height={220}>
          {cases.isPending ? (
            <Skeleton className="h-full w-full rounded-card" />
          ) : (
            <BarList data={fraudBreakdown(openCases)} emptyLabel="Açık vakada risk tipi yok" />
          )}
        </ChartFrame>

        <ChartFrame
          title="Model doğruluğu"
          hint="Fraud tipine göre isabet (precision); yanında yakalama oranı (recall)"
          height={220}
        >
          {categories.isPending ? (
            <Skeleton className="h-full w-full rounded-card" />
          ) : (
            <BarList data={categoryBars} emptyLabel="Yeterli örnek yok" />
          )}
        </ChartFrame>
      </div>

      {/* AI model kartı */}
      <section className="mt-6 surface-elevated p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-tile bg-brand-100 text-brand-700">
            <BrainCircuit className="size-4.5" aria-hidden />
          </span>
          <h2 className="text-h3 text-ink-900">Aktif model</h2>
          {metrics.data?.modelBundleVersion ? (
            <span className="rounded-pill bg-canvas px-2.5 py-0.5 font-mono text-micro text-ink-600">
              {metrics.data.modelBundleVersion}
            </span>
          ) : null}
        </div>
        {metrics.isPending ? (
          <Skeleton className="mt-4 h-16 w-full rounded-card" />
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-caption text-ink-500">Fraud tipi doğruluğu</dt>
              <dd className="mt-1 text-xl font-bold tabular text-ink-900">
                {formatPercent(metrics.data?.fraudTypeAccuracy)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-500">Karar uyumu</dt>
              <dd className="mt-1 text-xl font-bold tabular text-ink-900">
                {formatPercent(metrics.data?.decisionAgreementRate)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-500">Yanlış pozitif</dt>
              <dd className="mt-1 text-xl font-bold tabular text-ink-900">
                {formatPercent(metrics.data?.falsePositiveRate)}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-ink-500">Toplam tahmin</dt>
              <dd className="mt-1 text-xl font-bold tabular text-ink-900">
                {formatNumber(metrics.data?.totalPredictions ?? 0)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* Öncelikli vakalar */}
      <section className="mt-8" aria-labelledby="priority-cases-title">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="priority-cases-title" className="text-h2 text-ink-800">
            Öncelikli vakalar
          </h2>
          <Link
            to="/supervisor/cases"
            search={{}}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
          >
            Tüm vakalar <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] gap-3">
          {openCases.slice(0, 6).map((riskCase) => {
            const tone = riskTone(riskCase.effectiveRisk.riskLevel);
            return (
              <Link
                key={riskCase.caseId}
                to="/supervisor/cases/$caseId"
                params={{ caseId: riskCase.caseId }}
                className="surface-panel relative flex min-h-28 items-center overflow-hidden p-4 transition-shadow hover:shadow-raised"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} aria-hidden />
                <div className="min-w-0 flex-1 pl-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink-900">
                      {riskCase.transaction.transactionNo}
                    </p>
                    <ToneBadge toneClass={tone.chip}>
                      {riskCase.effectiveRisk.riskLevel
                        ? RISK_LEVEL_LABEL[riskCase.effectiveRisk.riskLevel]
                        : 'Belirsiz'}
                    </ToneBadge>
                    <SlaCountdown sla={riskCase.sla} compact />
                  </div>
                  <p className="mt-2 text-lg font-bold tabular text-ink-900">
                    {formatMoney(riskCase.transaction.amount, riskCase.transaction.currency)}
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    {riskCase.effectiveRisk.fraudType
                      ? FRAUD_TYPE_LABEL[riskCase.effectiveRisk.fraudType]
                      : 'Tip bekleniyor'}{' '}
                    · {CASE_STATUS_LABEL[riskCase.status]}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
