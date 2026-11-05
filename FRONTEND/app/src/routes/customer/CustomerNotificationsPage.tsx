import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CheckCheck, ChevronRight } from 'lucide-react';
import type { LiveNotification } from '@/features/notifications/model';
import { queryKeys } from '@/shared/api/query-keys';
import { formatRelative } from '@/shared/lib/format';
import { Button, CustomerPageHeader, EmptyState } from '@/shared/ui';

export function CustomerNotificationsPage() {
  const queryClient = useQueryClient();
  const notifications = useQuery<LiveNotification[]>({
    queryKey: queryKeys.notifications,
    queryFn: async () => [],
    initialData: [],
    staleTime: Number.POSITIVE_INFINITY,
  });

  const update = (map: (item: LiveNotification) => LiveNotification) => {
    queryClient.setQueryData<LiveNotification[]>(queryKeys.notifications, (current = []) =>
      current.map(map),
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <CustomerPageHeader
        title="Bildirimler"
        description="İşlemlerinle ilgili güncellemeler, en yenisi üstte."
        actions={notifications.data.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label="Tümünü okundu işaretle"
            leadingIcon={<CheckCheck className="size-4" />}
            onClick={() => update((item) => ({ ...item, read: true }))}
          >
            Okundu
          </Button>
        ) : null}
      />

      {notifications.data.length === 0 ? (
        <div className="surface-panel">
          <EmptyState
            illustration="inbox"
            title="Yeni bildirim yok"
            description="İşlemlerinle ilgili güncellemeler burada canlı olarak görünecek."
          />
        </div>
      ) : (
        <div className="surface-panel divide-y divide-line overflow-hidden">
          {notifications.data.map((item) => {
            const content = (
              <article
                className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-subtle sm:px-5 ${item.read ? '' : 'bg-brand-50/60'}`}
              >
                <span
                  className={`mt-1 size-2 shrink-0 rounded-full ${item.read ? 'bg-ink-200' : 'bg-brand-600'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-ink-900">{item.title}</p>
                    <p className="shrink-0 text-xs text-ink-500">{formatRelative(item.occurredAt)}</p>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{item.message}</p>
                </div>
                {item.resourceType === 'TRANSACTION' && item.resourceId ? (
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                ) : null}
              </article>
            );

            return item.resourceType === 'TRANSACTION' && item.resourceId ? (
              <Link
                key={item.id}
                to="/customer/transactions/$transactionId"
                params={{ transactionId: item.resourceId }}
                onClick={() =>
                  update((entry) => (entry.id === item.id ? { ...entry, read: true } : entry))
                }
              >
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
