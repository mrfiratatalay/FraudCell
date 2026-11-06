import { useQuery } from '@tanstack/react-query';
import { Medal } from 'lucide-react';
import { useSession } from '@/features/authentication/useSession';
import {
  getAnalystPerformance,
  getAnalystPoints,
  getMyGamificationProfile,
} from '@/features/gamification/api';
import { ANALYST_LEVELS, ANALYST_LEVEL_LABEL, type AnalystLevel } from '@/shared/api/contract';
import { FRAUD_TYPE_LABEL } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime, formatNumber, formatPercent } from '@/shared/lib/format';
import { seriesColor } from '@/shared/lib/risk';
import { cn } from '@/shared/lib/cn';
import { Avatar, EmptyState, ErrorState, KpiStrip, PageHeader, Skeleton, SkeletonList } from '@/shared/ui';
import { BarList, ChartFrame } from '@/shared/ui/charts';

const RULE_LABEL: Record<string, string> = {
  CASE_DECISION: 'Vaka kararı',
  FAST_DECISION: 'Hızlı karar',
  CONFIRMED_FRAUD: 'Doğrulanmış fraud',
  CRITICAL_WITHIN_SLA: 'Kritik vaka SLA içinde',
  SLA_BREACH: 'SLA ihlali',
  FALSE_POSITIVE: 'Yanlış pozitif',
};

/** Seviye ilerlemesi — bir sonraki seviyeye kaç puan kaldığını halkada gösterir. */
const LEVEL_FLOOR: Record<AnalystLevel, number> = {
  BRONZ: 0,
  GUMUS: 500,
  ALTIN: 1500,
  PLATIN: 3000,
};

function levelProgress(level: AnalystLevel, points: number): { pct: number; next: string } {
  const index = ANALYST_LEVELS.indexOf(level);
  const nextLevel = ANALYST_LEVELS[index + 1];
  if (!nextLevel) return { pct: 1, next: 'En üst seviye' };
  const floor = LEVEL_FLOOR[level];
  const ceil = LEVEL_FLOOR[nextLevel];
  const pct = Math.max(0, Math.min(1, (points - floor) / (ceil - floor)));
  return { pct, next: `${ANALYST_LEVEL_LABEL[nextLevel]} için ${formatNumber(Math.max(0, ceil - points))} puan` };
}

export function AnalystPointsPage() {
  const { user } = useSession();
  const analystId = user?.id ?? '';
  const profile = useQuery({
    queryKey: queryKeys.gamification.me,
    queryFn: getMyGamificationProfile,
    enabled: Boolean(analystId),
  });
  const points = useQuery({
    queryKey: queryKeys.gamification.points(analystId),
    queryFn: () => getAnalystPoints(analystId),
    enabled: Boolean(analystId),
  });
  const performance = useQuery({
    queryKey: queryKeys.gamification.performance(analystId),
    queryFn: () => getAnalystPerformance(analystId),
    enabled: Boolean(analystId),
  });

  const firstError = profile.error ?? points.error ?? performance.error;
  if (firstError) {
    return (
      <ErrorState
        error={firstError}
        onRetry={() => {
          void profile.refetch();
          void points.refetch();
          void performance.refetch();
        }}
      />
    );
  }

  const breakdown =
    performance.data?.fraudTypeBreakdown.map((row, index) => ({
      label: FRAUD_TYPE_LABEL[row.fraudType],
      value: row.decisionCount,
      color: seriesColor(index),
      meta: formatPercent(row.accuracyRate),
    })) ?? [];

  const name = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Analist' : 'Analist';
  const progress = profile.data ? levelProgress(profile.data.level, profile.data.totalPoints) : null;

  return (
    <div>
      <PageHeader title="Profilim" description="Puanın, seviyen ve karar performansın." />

      {/* Identity + level */}
      <section className="surface-panel flex flex-wrap items-center gap-x-8 gap-y-5 p-5" aria-labelledby="score-title">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-h2 text-ink-900">{name}</p>
            <p className="text-[13px] text-ink-500">
              Günlük sıra <strong className="font-medium text-ink-900">{profile.data?.dailyRank ?? '—'}</strong>
              <span className="mx-2 text-ink-300">·</span>
              Haftalık sıra <strong className="font-medium text-ink-900">{profile.data?.weeklyRank ?? '—'}</strong>
            </p>
          </div>
        </div>
        <div className="min-w-[16rem] flex-1">
          {profile.isPending ? (
            <Skeleton className="h-12 w-full" />
          ) : profile.data && progress ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="score-title" className="flex items-center gap-2 text-sm font-medium text-ink-900">
                  <span className="rounded-md bg-tc-500 px-2 py-0.5 text-xs font-semibold text-night-900">{ANALYST_LEVEL_LABEL[profile.data.level]}</span>
                  <span className="text-xl font-semibold tracking-[-0.02em] tabular">{formatNumber(profile.data.totalPoints)}</span>
                  <span className="text-ink-500">puan</span>
                </h2>
                <span className="text-xs text-ink-500">{progress.next}</span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-tc-500 transition-[width] duration-700" style={{ width: `${progress.pct * 100}%` }} />
              </div>
            </>
          ) : null}
        </div>
      </section>

      <KpiStrip
        className="mt-5"
        items={[
          { label: 'Çözülen vaka', value: performance.data?.totalDecisions ?? '—' },
          {
            label: 'Vaka başına ortalama puan',
            value:
              profile.data && profile.data.totalDecisions > 0
                ? formatNumber(Math.round(profile.data.totalPoints / profile.data.totalDecisions))
                : '—',
          },
          { label: 'Doğruluk', value: formatPercent(performance.data?.accuracyRate) },
          { label: 'SLA uyumlu', value: performance.data?.slaCompliantCount ?? '—' },
        ]}
      />

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Points ledger */}
        <section className="surface-panel overflow-hidden" aria-labelledby="ledger-title" data-testid="points-ledger">
          <h2 id="ledger-title" className="border-b border-line px-5 py-4 text-h3 text-ink-900">
            Puan hareketleri
          </h2>
          {points.isPending ? <SkeletonList rows={3} className="p-4" /> : null}
          {points.data?.length === 0 ? <EmptyState illustration="reward" title="Henüz puan hareketi yok" description="İlk kararınla birlikte burada görünür." /> : null}
          {points.data && points.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {points.data.map((item) => (
                <li key={item.ledgerId} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">{RULE_LABEL[item.ruleCode] ?? item.description}</p>
                    <p className="text-xs text-ink-500">{formatDateTime(item.occurredAt)}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 font-mono text-[13px] font-medium tabular',
                      item.points >= 0 ? 'bg-success-100 text-success-700' : 'bg-critical-100 text-critical-700',
                    )}
                  >
                    {item.points >= 0 ? '+' : ''}
                    {item.points}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="space-y-5">
          <section className="surface-panel p-5" aria-labelledby="badges-title">
            <h2 id="badges-title" className="text-h3 text-ink-900">
              Rozetler
            </h2>
            {profile.data?.badges.length ? (
              <ul className="mt-4 space-y-2">
                {profile.data.badges.map((badge) => (
                  <li key={badge.code} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tc-100 text-tc-700 ring-1 ring-tc-500/30">
                      <Medal className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{badge.displayName}</p>
                      <p className="text-xs text-ink-500">{formatDateTime(badge.earnedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-500">Henüz rozet yok. İlk doğru blok kararı "İlk Yakalama" rozetini getirir.</p>
            )}
          </section>

          <ChartFrame title="Türe göre kararlar" hint="Karar sayısı · doğruluk">
            <BarList data={breakdown} emptyLabel="Henüz karar yok" />
          </ChartFrame>
        </div>
      </div>
    </div>
  );
}
