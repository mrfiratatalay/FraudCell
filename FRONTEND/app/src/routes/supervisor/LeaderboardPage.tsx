import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { getLeaderboard } from '@/features/gamification/api';
import { ANALYST_LEVEL_LABEL, type AnalystLevel, type LeaderboardPeriod } from '@/shared/api/contract';
import { queryKeys } from '@/shared/api/query-keys';
import { formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { Avatar, EmptyState, ErrorState, PageHeader, SkeletonList, Tabs } from '@/shared/ui';

export function LeaderboardPage({ period }: { period: LeaderboardPeriod }) {
  const navigate = useNavigate();
  const leaderboard = useQuery({
    queryKey: queryKeys.gamification.leaderboard(period),
    queryFn: () => getLeaderboard(period),
  });

  const items = leaderboard.data?.items ?? [];
  const top = Math.max(1, ...items.map((item) => item.points));

  return (
    <div>
      <PageHeader title="Liderlik tablosu" description="Analistlerin puanı, karar sayısı ve rozetleri." />

      <Tabs
        className="mb-5"
        items={[
          { value: 'daily', label: 'Günlük' },
          { value: 'weekly', label: 'Haftalık' },
        ]}
        value={period}
        onValueChange={(value) =>
          void navigate({ to: '/supervisor/leaderboard', search: { period: value as LeaderboardPeriod } })
        }
      />

      <section aria-live="polite">
        {leaderboard.isPending ? <SkeletonList rows={6} /> : null}
        {leaderboard.isError ? <ErrorState error={leaderboard.error} onRetry={() => void leaderboard.refetch()} /> : null}
        {leaderboard.isSuccess && items.length === 0 ? (
          <div className="surface-panel">
            <EmptyState illustration="reward" title="Bu dönemde sıralama yok" description="Analistler karar verdikçe tablo dolar." />
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="surface-panel overflow-hidden">
            <div className="hidden grid-cols-[3rem_minmax(12rem,1fr)_minmax(10rem,1.2fr)_6rem_6rem] gap-4 border-b border-line bg-subtle px-5 py-2.5 text-xs font-medium text-ink-500 md:grid" aria-hidden>
              <span>Sıra</span>
              <span>Analist</span>
              <span>Puan</span>
              <span className="text-right">Karar</span>
              <span className="text-right">Rozet</span>
            </div>
            <ol className="divide-y divide-line" aria-label="Sıralama">
              {items.map((item) => (
                <li
                  key={item.analystId}
                  className="grid grid-cols-[3rem_1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 md:grid-cols-[3rem_minmax(12rem,1fr)_minmax(10rem,1.2fr)_6rem_6rem]"
                >
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md font-mono text-[13px] font-semibold tabular',
                      item.rank === 1 ? 'bg-tc-500 text-night-900' : item.rank <= 3 ? 'bg-ink-100 text-ink-900' : 'text-ink-500',
                    )}
                  >
                    {item.rank}
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={item.displayName ?? item.analystId} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{item.displayName ?? 'Analist'}</p>
                      <p className="text-xs text-ink-500">{ANALYST_LEVEL_LABEL[item.level as AnalystLevel] ?? item.level}</p>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center gap-3 md:col-span-1">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <div className={cn('h-full rounded-full', item.rank === 1 ? 'bg-tc-500' : 'bg-brand-500')} style={{ width: `${Math.max(2, (item.points / top) * 100)}%` }} />
                    </div>
                    <span className="w-14 text-right text-sm font-semibold text-ink-900 tabular">{formatNumber(item.points)}</span>
                  </div>
                  <span className="hidden text-right text-sm text-ink-700 tabular md:block">{item.decisionCount}</span>
                  <span className="hidden text-right text-sm text-ink-700 tabular md:block">{item.badgeCount}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    </div>
  );
}
