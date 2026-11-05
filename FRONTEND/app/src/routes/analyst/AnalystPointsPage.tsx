import { useQuery } from '@tanstack/react-query';
import { Medal, Sparkles, Star } from 'lucide-react';
import { useSession } from '@/features/authentication/useSession';
import {
  getAnalystPerformance,
  getAnalystPoints,
  getMyGamificationProfile,
} from '@/features/gamification/api';
import { ANALYST_LEVELS, type AnalystLevel } from '@/shared/api/contract';
import { FRAUD_TYPE_LABEL } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime, formatNumber, formatPercent } from '@/shared/lib/format';
import { seriesColor } from '@/shared/lib/risk';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  SkeletonList,
  StatTile,
} from '@/shared/ui';
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
  return { pct, next: `${nextLevel} için ${formatNumber(Math.max(0, ceil - points))} puan` };
}

/** Turkcell sarısı seviye halkası. */
function LevelRing({ level, points }: { level: AnalystLevel; points: number }) {
  const { pct } = levelProgress(level, points);
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" strokeWidth="9" className="stroke-white/25" />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke="var(--color-tc-500)"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-xl font-bold">{level}</span>
        <span className="text-micro text-white/70">seviye</span>
      </div>
    </div>
  );
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

  return (
    <div>
      <PageHeader
        title="Profilim"
        description="Karar performansı, seviye ve kazanılan rozetler."
      />

      {/* Seviye kahramanı */}
      {profile.isPending ? (
        <Skeleton className="h-44 w-full rounded-card" />
      ) : profile.data ? (
        <section
          className="relative overflow-hidden rounded-card gradient-header p-6 text-white"
          aria-labelledby="score-title"
        >
          <div className="hero-mesh absolute inset-0" aria-hidden />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 id="score-title" className="text-sm text-white/75">
                Toplam puan
              </h2>
              <p className="mt-1 text-4xl font-bold tabular">
                {formatNumber(profile.data.totalPoints)}
              </p>
              <p className="mt-3 text-sm text-white/80">
                {levelProgress(profile.data.level, profile.data.totalPoints).next}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/80">
                <span>
                  Günlük sıra:{' '}
                  <strong className="text-white">{profile.data.dailyRank ?? '—'}</strong>
                </span>
                <span>
                  Haftalık sıra:{' '}
                  <strong className="text-white">{profile.data.weeklyRank ?? '—'}</strong>
                </span>
              </div>
            </div>
            <LevelRing level={profile.data.level} points={profile.data.totalPoints} />
          </div>
        </section>
      ) : null}

      {/* Performans özeti */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Performans özeti">
        {performance.isPending ? (
          <>
            <Skeleton className="h-28 rounded-card" />
            <Skeleton className="h-28 rounded-card" />
            <Skeleton className="h-28 rounded-card" />
            <Skeleton className="h-28 rounded-card" />
          </>
        ) : performance.data ? (
          <>
            <StatTile label="Çözülen vaka" value={performance.data.totalDecisions} />
            <StatTile
              label="Vaka başına ortalama puan"
              value={
                profile.data && profile.data.totalDecisions > 0
                  ? formatNumber(Math.round(profile.data.totalPoints / profile.data.totalDecisions))
                  : '—'
              }
            />
            <StatTile
              label="Doğruluk"
              value={formatPercent(performance.data.accuracyRate)}
              tone="text-success-700"
            />
            <StatTile label="SLA uyumlu" value={performance.data.slaCompliantCount} />
          </>
        ) : null}
      </section>

      {/* Fraud tipi kırılımı + rozetler */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartFrame title="Fraud tipine göre kararlar" hint="Karar sayısı ve doğruluk oranı" height={220}>
          <BarList data={breakdown} emptyLabel="Henüz karar yok" />
        </ChartFrame>

        <section className="surface-panel p-6" aria-labelledby="badges-title">
          <div className="flex items-center gap-2">
            <Medal className="size-5 text-warning-500" aria-hidden />
            <h2 id="badges-title" className="text-h3 text-ink-900">
              Rozetler
            </h2>
          </div>
          {profile.data?.badges.length ? (
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {profile.data.badges.map((badge) => (
                <div
                  key={badge.code}
                  className="flex items-center gap-3 rounded-tile bg-canvas px-3.5 py-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tc-100 text-warning-700">
                    <Medal className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {badge.displayName}
                    </p>
                    <p className="text-micro text-ink-400">{formatDateTime(badge.earnedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-400">Henüz rozet kazanılmadı.</p>
          )}
        </section>
      </div>

      {/* Puan hareketleri */}
      <section className="mt-6" aria-labelledby="ledger-title" data-testid="points-ledger">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-5 text-brand-700" />
          <h2 id="ledger-title" className="text-h2 text-ink-900">
            Puan hareketleri
          </h2>
        </div>
        {points.isPending ? <SkeletonList rows={3} /> : null}
        {points.data?.length === 0 ? (
          <EmptyState illustration="reward" title="Henüz puan hareketi yok" />
        ) : null}
        {points.data && points.data.length > 0 ? (
          <div className="surface-panel divide-y divide-ink-100 overflow-hidden">
            {points.data.map((item) => (
              <div key={item.ledgerId} className="flex items-center gap-4 px-4 py-3.5">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                    item.points >= 0
                      ? 'bg-success-100 text-success-700'
                      : 'bg-danger-100 text-danger-700'
                  }`}
                >
                  <Star className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">
                    {RULE_LABEL[item.ruleCode] ?? item.description}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(item.occurredAt)}</p>
                </div>
                <p
                  className={`font-bold tabular ${
                    item.points >= 0 ? 'text-success-700' : 'text-danger-700'
                  }`}
                >
                  {item.points >= 0 ? '+' : ''}
                  {item.points}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
