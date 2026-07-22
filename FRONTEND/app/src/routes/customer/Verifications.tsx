import { useState } from 'react';
import { CheckCircle2, MapPin, ShieldCheck, ShieldX } from 'lucide-react';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  SkeletonList,
  useToast,
} from '@/shared/ui';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { messageFor } from '@/shared/api/errors';
import { TRANSACTION_TYPE_LABEL } from '@/shared/api/enums';
import type { PendingVerificationResponse } from '@/shared/api/contract';
import {
  usePendingVerifications,
  useRespondVerification,
} from '@/features/verifications/hooks';

/**
 * Müşteri doğrulama ekranı (UX-CUS-005).
 *
 * "Ben yapmadım" geri alınamaz bir güvenlik eylemi: işlemi geçici bloka alır
 * ve risk skorunu en üste çeker. Bu yüzden onay diyaloğu ile korunuyor ve
 * DESIGN.MD kural 1 gereği optimistic GÜNCELLENMİYOR — backend yanıtı
 * beklenir.
 */
export function CustomerVerifications() {
  const query = usePendingVerifications();
  const items = query.data ?? [];

  return (
    <div className="px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-ink-900">Doğrulama</h1>
      <p className="mb-5 text-sm text-ink-500">
        Şüpheli görünen işlemleri senin onayın olmadan tamamlamıyoruz.
      </p>

      {query.isPending ? (
        <SkeletonList rows={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title="Bekleyen doğrulaman yok"
          description="Bir işlemin için onayın gerektiğinde burada ve bildirimlerde göreceksin."
        />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.verificationId}>
              <VerificationCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VerificationCard({ item }: { item: PendingVerificationResponse }) {
  const toast = useToast();
  const respond = useRespondVerification(item.caseId);
  const [confirming, setConfirming] = useState(false);

  const send = (response: 'MINE' | 'NOT_MINE') => {
    respond.mutate(
      { verificationId: item.verificationId, response },
      {
        onSuccess: () => {
          setConfirming(false);
          if (response === 'MINE') {
            toast.success('Teşekkürler', 'İşlemi onayladığın kaydedildi.');
          } else {
            toast.warning('İşlem bloklandı', 'Güvenliğin için işlem durduruldu.');
          }
        },
        onError: (error) => {
          setConfirming(false);
          toast.fromError(error);
        },
      },
    );
  };

  return (
    <Card rail="bg-warning-500">
      <p className="text-sm text-ink-500">{item.transactionNo}</p>
      <p className="mt-1 text-2xl font-bold tabular text-ink-900">
        {formatMoney(item.amount, item.currency)}
      </p>
      <p className="mt-1 text-[15px] text-ink-700">
        {TRANSACTION_TYPE_LABEL[item.transactionType]}
      </p>

      <dl className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-sm">
        <div className="flex items-center gap-2 text-ink-700">
          <MapPin className="size-4 shrink-0 text-ink-400" aria-hidden />
          {item.city}, {item.countryCode}
        </div>
        <div className="text-ink-500">{formatDateTime(item.occurredAt)}</div>
      </dl>

      <p className="mt-4 text-[15px] font-semibold text-ink-900">Bu işlemi sen mi yaptın?</p>

      {respond.isError && (
        <Banner tone="danger" className="mt-3">
          {messageFor(respond.error)}
        </Banner>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          fullWidth
          leadingIcon={<ShieldCheck className="size-4" />}
          loading={respond.isPending && !confirming}
          onClick={() => send('MINE')}
        >
          Evet, ben yaptım
        </Button>
        <Button
          fullWidth
          variant="danger"
          leadingIcon={<ShieldX className="size-4" />}
          disabled={respond.isPending}
          onClick={() => setConfirming(true)}
        >
          Hayır, ben yapmadım
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="İşlemi bloklayalım mı?"
        description="Bu adım geri alınamaz."
        confirmLabel="Evet, ben yapmadım"
        cancelLabel="Vazgeç"
        destructive
        loading={respond.isPending}
        onConfirm={() => send('NOT_MINE')}
      >
        <p className="text-sm leading-relaxed text-ink-700">
          <strong className="font-semibold text-ink-900">
            {formatMoney(item.amount, item.currency)}
          </strong>{' '}
          tutarındaki işlem hemen bloklanacak ve bir güvenlik uzmanı vakayı
          inceleyecek. Kartın veya hesabın ele geçirilmiş olabilir.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
