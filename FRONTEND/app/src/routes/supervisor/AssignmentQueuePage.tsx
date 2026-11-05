import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { listAssignmentQueue } from '@/features/cases/api';
import type { QueueType } from '@/shared/api/enums';
import { ASSIGNMENT_STATUS_LABEL, RISK_LEVEL_LABEL } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime } from '@/shared/lib/format';
import { riskTone } from '@/shared/lib/risk';
import { EmptyState, ErrorState, PageHeader, SkeletonList, Tabs, ToneBadge } from '@/shared/ui';

export function AssignmentQueuePage({ queueType }: { queueType: QueueType }) {
  const navigate = useNavigate();
  const queue = useQuery({
    queryKey: queryKeys.cases.assignmentQueue(queueType),
    queryFn: () => listAssignmentQueue({ queueType, limit: 100 }),
  });

  const items = queue.data?.items ?? [];

  return (
    <div>
      <PageHeader title="Atama kuyruğu" description="BELIRSIZ ve analist kapasitesi bekleyen vakalar. Manuel atama için vakayı açın." />

      <div className="mb-5">
        <Tabs
          items={[
            { value: 'ALL', label: 'Tümü', count: queueType === 'ALL' ? items.length : undefined },
            { value: 'QUEUED', label: 'Kapasite bekleyen', count: queueType === 'QUEUED' ? items.length : undefined },
            { value: 'MANUAL_QUEUE', label: 'Belirsiz / manuel', count: queueType === 'MANUAL_QUEUE' ? items.length : undefined },
          ]}
          value={queueType}
          onValueChange={(value) =>
            void navigate({ to: '/supervisor/queue', search: { queueType: value as QueueType } })
          }
        />
      </div>

      {queue.isPending ? <SkeletonList rows={5} /> : null}
      {queue.isError ? <ErrorState error={queue.error} onRetry={() => void queue.refetch()} /> : null}
      {!queue.isPending && !queue.isError && items.length === 0 ? (
        <EmptyState
          illustration="secure"
          title="Bu kuyrukta vaka yok"
          description="Atama bekleyen vaka oluştuğunda burada listelenecek."
        />
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const riskLevel = item.displayRiskLevel === 'BELIRSIZ' ? null : item.displayRiskLevel;
          const tone = riskTone(riskLevel);
          return (
            <Link
              key={item.caseId}
              to="/supervisor/cases/$caseId"
              params={{ caseId: item.caseId }}
              className="surface-panel relative grid min-h-24 grid-cols-[1fr_auto] items-center gap-4 overflow-hidden p-4 transition-shadow hover:shadow-raised"
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} aria-hidden />
              <div className="min-w-0 pl-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink-900">{item.transactionNo}</p>
                  <ToneBadge toneClass={tone.chip}>
                    {riskLevel ? RISK_LEVEL_LABEL[riskLevel] : 'Belirsiz'}
                  </ToneBadge>
                  <ToneBadge toneClass="bg-ink-100 text-ink-600">
                    {ASSIGNMENT_STATUS_LABEL[item.assignmentStatus]}
                  </ToneBadge>
                </div>
                <p className="mt-2 text-sm text-ink-500">
                  {item.manualReviewReason ?? 'Atama adayı bekleniyor'}
                </p>
                <p className="mt-1 text-xs text-ink-400">SLA: {formatDateTime(item.slaDeadlineAt)}</p>
              </div>
              <ChevronRight className="size-5 text-ink-400" aria-hidden />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
