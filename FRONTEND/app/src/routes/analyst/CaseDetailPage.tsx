import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Hourglass, Play, ShieldCheck, ShieldX, UserRoundCheck, UserRoundX } from 'lucide-react';
import { CaseFacts, CaseHeader, CaseHistoryPanel, RiskAssessmentPanel } from '@/features/cases/CaseParts';
import {
  getCase,
  getCaseHistory,
  requestCustomerVerification,
  startCaseReview,
  submitCaseDecision,
} from '@/features/cases/api';
import { messageFor } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/query-keys';
import { cn } from '@/shared/lib/cn';
import { Banner, Button, ErrorState, Skeleton, TextAreaField } from '@/shared/ui';

export function CaseDetailPage({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const riskCase = useQuery({
    queryKey: queryKeys.cases.detail(caseId),
    queryFn: () => getCase(caseId),
    // Müşterinin cevabı gelince vaka INCELENIYOR'a döner; bekleme sırasında hafifçe yokla.
    refetchInterval: (query) =>
      query.state.data?.data.status === 'MUSTERI_DOGRULAMA' ? 3000 : false,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.all }),
    ]);
  };

  const review = useMutation({
    mutationFn: () => {
      const version = riskCase.data?.etag ?? riskCase.data?.data.version;
      if (version === undefined || version === null) throw new Error('Vaka sürümü bulunamadı.');
      return startCaseReview(caseId, version);
    },
    onSuccess: refresh,
    onError: (error) => setActionError(messageFor(error)),
  });

  const verification = useMutation({
    mutationFn: () => {
      const version = riskCase.data?.etag ?? riskCase.data?.data.version;
      if (version === undefined || version === null) throw new Error('Vaka sürümü bulunamadı.');
      return requestCustomerVerification(caseId, version);
    },
    onSuccess: refresh,
    onError: (error) => setActionError(messageFor(error)),
  });

  // Müşterinin "ben yaptım / yapmadım" cevabı vaka geçmişinde CUSTOMER kaynaklı geçiş olarak durur.
  const history = useQuery({
    queryKey: queryKeys.cases.history(caseId),
    queryFn: () => getCaseHistory(caseId),
  });
  const customerAnswer = history.data
    ?.filter((item) => item.transitionSource === 'CUSTOMER')
    .at(-1);

  const decision = useMutation({
    mutationFn: (selected: 'APPROVE' | 'BLOCK') => {
      const version = riskCase.data?.etag ?? riskCase.data?.data.version;
      if (version === undefined || version === null) throw new Error('Vaka sürümü bulunamadı.');
      return submitCaseDecision(caseId, version, {
        decision: selected,
        note: note.trim() || null,
        overrideReason: null,
      });
    },
    onSuccess: async () => {
      setNote('');
      await refresh();
    },
    onError: (error) => setActionError(messageFor(error)),
  });

  if (riskCase.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 w-full rounded-card" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-80 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      </div>
    );
  }
  if (riskCase.isError) {
    return <ErrorState error={riskCase.error} onRetry={() => void riskCase.refetch()} />;
  }

  const item = riskCase.data.data;
  const canReview = item.status === 'ATANDI';
  const canDecide = item.status === 'INCELENIYOR';
  const waiting = item.status === 'MUSTERI_DOGRULAMA';
  const decided = item.status === 'ONAYLANDI' || item.status === 'BLOKLANDI' || item.status === 'KAPANDI';
  const notMine = customerAnswer?.reason?.includes('NOT_MINE') ?? false;

  return (
    <div>
      <CaseHeader item={item} />

      {actionError ? (
        <Banner tone="danger" className="mb-4">
          {actionError}
        </Banner>
      ) : null}

      <CaseFacts item={item} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <RiskAssessmentPanel item={item} />

        <aside
          aria-labelledby="action-title"
          className="surface-panel overflow-hidden lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <div className="border-b border-line px-5 py-4">
            <h2 id="action-title" className="text-h3 text-ink-900">
              Karar
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-500">
              {canReview
                ? 'Adım 1 · incelemeyi başlat'
                : canDecide
                  ? 'Adım 2 · kanıtları tart, karar ver'
                  : waiting
                    ? 'Müşterinin yanıtı bekleniyor'
                    : decided
                      ? 'Bu vaka için karar verildi'
                      : 'Bu vakada bekleyen işlem yok'}
            </p>
          </div>

          <div className="space-y-4 p-5">
            {customerAnswer ? (
              <div
                data-testid="customer-answer"
                className={cn(
                  'flex items-start gap-3 rounded-lg p-3.5 ring-1 ring-inset',
                  notMine ? 'bg-critical-100 text-critical-700 ring-critical-500/20' : 'bg-success-100 text-success-700 ring-success-500/20',
                )}
              >
                {notMine ? <UserRoundX className="mt-0.5 size-4 shrink-0" aria-hidden /> : <UserRoundCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <div className="text-sm">
                  <p className="text-xs opacity-80">Müşteri cevabı</p>
                  <p className="font-semibold">{notMine ? 'Ben yapmadım' : 'Ben yaptım'}</p>
                </div>
              </div>
            ) : null}

            {canReview ? (
              <>
                <p className="text-sm text-ink-600">
                  İncelemeyi başlattığında vaka senin üzerinde kilitlenir; karar ve müşteri doğrulaması açılır.
                </p>
                <Button
                  fullWidth
                  size="lg"
                  loading={review.isPending}
                  onClick={() => {
                    setActionError(null);
                    review.mutate();
                  }}
                  leadingIcon={<Play className="size-4" />}
                >
                  İncelemeyi başlat
                </Button>
              </>
            ) : null}

            {waiting ? (
              <div className="flex items-start gap-3 rounded-lg bg-warning-100 p-3.5 text-sm text-warning-700" role="status">
                <Hourglass className="mt-0.5 size-4 shrink-0 animate-pulse" aria-hidden />
                <span>Müşteriden doğrulama bekleniyor. Yanıt gelince karar adımı kendiliğinden açılır.</span>
              </div>
            ) : null}

            {canDecide ? (
              <>
                {!customerAnswer ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    loading={verification.isPending}
                    onClick={() => {
                      setActionError(null);
                      verification.mutate();
                    }}
                    leadingIcon={<ShieldCheck className="size-4" />}
                  >
                    Müşteriden doğrulama iste
                  </Button>
                ) : null}
                <TextAreaField
                  label="Karar notu"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  hint="Blok kararında not zorunludur."
                  placeholder="Kararın gerekçesi…"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    loading={decision.isPending && decision.variables === 'APPROVE'}
                    onClick={() => {
                      setActionError(null);
                      decision.mutate('APPROVE');
                    }}
                    leadingIcon={<Check className="size-4" />}
                  >
                    Onayla
                  </Button>
                  <Button
                    variant="danger"
                    loading={decision.isPending && decision.variables === 'BLOCK'}
                    disabled={!note.trim()}
                    onClick={() => {
                      setActionError(null);
                      decision.mutate('BLOCK');
                    }}
                    leadingIcon={<ShieldX className="size-4" />}
                  >
                    Blokla
                  </Button>
                </div>
              </>
            ) : null}

            {decided ? (
              <div className="space-y-2 text-sm">
                <p className="text-ink-600">
                  Karar:{' '}
                  <span className={cn('font-semibold', item.finalDecision === 'BLOCK' || item.status === 'BLOKLANDI' ? 'text-critical-600' : 'text-success-600')}>
                    {item.finalDecision === 'BLOCK' || item.status === 'BLOKLANDI' ? 'Blok' : 'Onay'}
                  </span>
                </p>
                {item.decisionNote ? <p className="rounded-lg bg-subtle p-3 text-ink-700 ring-1 ring-line">{item.decisionNote}</p> : null}
              </div>
            ) : null}
          </div>
        </aside>

        <CaseHistoryPanel caseId={caseId} createdAt={item.createdAt} />
      </div>
    </div>
  );
}
