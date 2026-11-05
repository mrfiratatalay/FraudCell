import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, MapPin, ShieldCheck } from 'lucide-react';
import { listPendingVerifications, submitVerification } from '@/features/customer/api';
import type { PendingVerificationResponse } from '@/shared/api/contract';
import type { CustomerVerificationChoice } from '@/shared/api/enums';
import { TRANSACTION_TYPE_LABEL } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import {
  Button,
  ConfirmDialog,
  CustomerPageHeader,
  EmptyState,
  ErrorState,
  SkeletonList,
  useToast,
} from '@/shared/ui';

interface PendingChoice {
  item: PendingVerificationResponse;
  response: CustomerVerificationChoice;
}

export function CustomerVerificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [choice, setChoice] = useState<PendingChoice | null>(null);
  const verifications = useQuery({
    queryKey: queryKeys.pendingVerifications,
    queryFn: listPendingVerifications,
  });
  const answer = useMutation({
    mutationFn: (selected: PendingChoice) =>
      submitVerification(selected.item.caseId, {
        verificationId: selected.item.verificationId,
        response: selected.response,
      }),
    onSuccess: async (_, selected) => {
      setChoice(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingVerifications });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.detail(selected.item.transactionId),
      });
      toast.success('Yanıt kaydedildi');
    },
    onError: (error) => toast.fromError(error),
  });

  const items = verifications.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <CustomerPageHeader
        title="Doğrulamalar"
        description="Sana ait olup olmadığını sorduğumuz işlemler. Yanıtın, incelemeyi yapan analiste anında ulaşır."
      />

      {verifications.isPending ? (
        <SkeletonList rows={2} />
      ) : null}
      {verifications.isError ? (
        <ErrorState error={verifications.error} onRetry={() => void verifications.refetch()} />
      ) : null}
      {!verifications.isPending && !verifications.isError && items.length === 0 ? (
        <div className="surface-panel">
          <EmptyState
            illustration="secure"
            title="Bekleyen doğrulama yok"
            description="Bir işlem şüpheli görünürse sana burada &quot;Bu işlemi sen mi yaptın?&quot; diye soracağız."
          />
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,32rem),1fr))] gap-4">
        {items.map((item) => (
          <article
            key={item.verificationId}
            className="surface-card overflow-hidden !border-warning-500/40"
          >
            <div className="flex items-center gap-2 border-b border-warning-500/25 bg-warning-100 px-4 py-2.5 text-warning-700">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              <p className="text-sm font-semibold">Bu işlemi sen mi yaptın?</p>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-medium text-ink-900">{item.transactionNo}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {TRANSACTION_TYPE_LABEL[item.transactionType]}
                  </p>
                </div>
                <p className="shrink-0 text-xl font-semibold tracking-[-0.02em] tabular text-ink-900">
                  {formatMoney(item.amount, item.currency)}
                </p>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0 text-ink-400" aria-hidden />
                  <span className="truncate text-ink-700">
                    {item.city}, {item.countryCode}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock3 className="size-4 shrink-0 text-ink-400" aria-hidden />
                  <span className="truncate text-ink-700">{formatDateTime(item.occurredAt)}</span>
                </div>
              </dl>

              <p className="mt-3 text-xs text-ink-400">
                Son yanıt zamanı: {formatDateTime(item.expiresAt)}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Button
                  variant="secondary"
                  onClick={() => setChoice({ item, response: 'MINE' })}
                  disabled={answer.isPending}
                >
                  Ben yaptım
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setChoice({ item, response: 'NOT_MINE' })}
                  disabled={answer.isPending}
                >
                  Ben yapmadım
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={choice !== null}
        onOpenChange={(open) => {
          if (!open && !answer.isPending) setChoice(null);
        }}
        title={choice?.response === 'NOT_MINE' ? 'İşlem sana ait değil mi?' : 'İşlem sana ait mi?'}
        description={
          choice?.response === 'NOT_MINE'
            ? 'Yanıtından sonra işlem güvenlik için geçici olarak bloke edilir.'
            : 'Bu yanıt vaka incelemesine iletilecek.'
        }
        confirmLabel="Yanıtı gönder"
        destructive={choice?.response === 'NOT_MINE'}
        loading={answer.isPending}
        onConfirm={() => {
          if (choice) answer.mutate(choice);
        }}
      />
    </div>
  );
}
