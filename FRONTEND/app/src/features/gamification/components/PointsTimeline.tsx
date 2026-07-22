import type { PointEntry } from '@/shared/api/contract-pending';
import { POINT_RULE_LABEL } from '@/shared/api/contract-pending';
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { formatDateTime } from '@/shared/lib/format';

export function PointsTimeline({
  entries,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  entries: PointEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (isLoading) return <SkeletonList rows={3} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (!entries || entries.length === 0) return <EmptyState title="Henüz puan kazanılmadı" />;

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="surface-card flex items-center justify-between p-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">{POINT_RULE_LABEL[entry.ruleCode]}</p>
            <p className="text-xs text-ink-500">
              {entry.transactionNo ?? '—'} · {formatDateTime(entry.occurredAt)}
            </p>
          </div>
          <span
            className={cn(
              'text-sm font-bold tabular',
              entry.points >= 0 ? 'text-success-700' : 'text-danger-500',
            )}
          >
            {entry.points >= 0 ? '+' : ''}
            {entry.points}
          </span>
        </li>
      ))}
    </ul>
  );
}
