import type { LeaderboardEntry } from '@/shared/api/contract-pending';
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { formatPercent } from '@/shared/lib/format';

export function LeaderboardTable({
  entries,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  entries: LeaderboardEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (isLoading) return <SkeletonList rows={5} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (!entries || entries.length === 0) return <EmptyState title="Liderlik tablosu henüz oluşmadı" />;

  return (
    <div className="surface-card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs font-semibold text-ink-500">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Analist</th>
            <th className="px-4 py-3">Puan</th>
            <th className="px-4 py-3">Çözülen</th>
            <th className="px-4 py-3">Doğruluk</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.analystId}
              className={cn(
                'border-b border-ink-100 last:border-0',
                entry.isCurrentUser && 'bg-brand-100/50',
              )}
            >
              <td className="px-4 py-3 font-bold tabular">{entry.rank}</td>
              <td className="px-4 py-3 font-semibold">{entry.analystName}</td>
              <td className="px-4 py-3 tabular">{entry.points}</td>
              <td className="px-4 py-3 tabular">{entry.resolvedCases}</td>
              <td className="px-4 py-3 tabular">{formatPercent(entry.accuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
