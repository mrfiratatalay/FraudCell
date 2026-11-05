import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { listAssignmentQueue } from '@/features/cases/api';
import type { QueueType } from '@/shared/api/enums';
import { ASSIGNMENT_STATUS_LABEL } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime } from '@/shared/lib/format';
import { EmptyState, ErrorState, PageHeader, RiskScore, SkeletonList, Tabs } from '@/shared/ui';

export function AssignmentQueuePage({ queueType }: { queueType: QueueType }) {
  const navigate = useNavigate();
  const queue = useQuery({
    queryKey: queryKeys.cases.assignmentQueue(queueType),
    queryFn: () => listAssignmentQueue({ queueType, limit: 100 }),
  });

  const items = queue.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Atama kuyruğu"
        description="Otomatik atanamayan vakalar: risk türü belirsiz olanlar ve uygun analist kapasitesi bekleyenler. Atamak için vakayı aç."
      />

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
      {queue.isSuccess && items.length === 0 ? (
        <div className="surface-panel">
          <EmptyState illustration="secure" title="Kuyruk boş" description="Otomatik atanamayan bir vaka oluşunca burada görünür." />
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="surface-panel overflow-hidden">
          <div className="hidden grid-cols-[8.5rem_minmax(10rem,1fr)_10rem_minmax(12rem,1.4fr)_9rem] gap-4 border-b border-line bg-subtle px-4 py-2.5 text-xs font-medium text-ink-500 lg:grid" aria-hidden>
            <span>Risk</span>
            <span>İşlem</span>
            <span>Kuyruk</span>
            <span>Neden</span>
            <span className="text-right">SLA bitişi</span>
          </div>
          <ul aria-label="Atama bekleyen vakalar" className="divide-y divide-line">
            {items.map((item) => {
              const riskLevel = item.displayRiskLevel === 'BELIRSIZ' ? null : item.displayRiskLevel;
              return (
                <li key={item.caseId}>
                  <Link
                    to="/supervisor/cases/$caseId"
                    params={{ caseId: item.caseId }}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 transition-colors hover:bg-subtle lg:grid-cols-[8.5rem_minmax(10rem,1fr)_10rem_minmax(12rem,1.4fr)_9rem] lg:py-3"
                  >
                    <RiskScore level={riskLevel} score={null} className="order-2 lg:order-none" />
                    <span className="order-1 font-mono text-[13px] font-medium text-ink-900 lg:order-none">{item.transactionNo}</span>
                    <span className="order-3 text-[13px] text-ink-700 lg:order-none">{ASSIGNMENT_STATUS_LABEL[item.assignmentStatus]}</span>
                    <span className="order-5 col-span-2 text-[13px] text-ink-500 lg:order-none lg:col-span-1">
                      {item.manualReviewReason ?? 'Uygun analist bekleniyor'}
                    </span>
                    <span className="order-4 text-right text-xs text-ink-500 tabular lg:order-none">
                      {formatDateTime(item.slaDeadlineAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
