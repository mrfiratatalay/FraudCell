import type { CaseTransitionResponse } from '@/shared/api/contract';
import { CASE_STATUS_LABEL, TRANSITION_SOURCE_LABEL } from '@/shared/api/enums';
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib/format';

export function CaseHistoryTimeline({
  history,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  history: CaseTransitionResponse[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (isLoading) return <SkeletonList rows={3} />;
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (!history || history.length === 0) return <EmptyState title="Henüz geçmiş kaydı yok" />;

  return (
    <ol className="space-y-3">
      {history.map((t) => (
        <li key={t.id} className="border-l-2 border-ink-200 pl-4">
          <p className="text-sm font-semibold text-ink-900">
            {CASE_STATUS_LABEL[t.previousStatus]} → {CASE_STATUS_LABEL[t.newStatus]}
          </p>
          <p className="text-xs text-ink-500">
            {TRANSITION_SOURCE_LABEL[t.transitionSource]} · {formatDateTime(t.occurredAt)}
          </p>
          {t.reason && <p className="mt-1 text-sm text-ink-700">{t.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
