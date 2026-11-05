import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  Bot,
  Check,
  Clock3,
  MapPin,
  Play,
  Send,
  ShieldX,
} from 'lucide-react';
import { getExplanationByTransaction } from '@/features/ai/api';
import {
  getCase,
  getCaseHistory,
  requestCustomerVerification,
  startCaseReview,
  submitCaseDecision,
} from '@/features/cases/api';
import { CASE_STATUS_LABEL, FRAUD_TYPE_LABEL } from '@/shared/api/enums';
import { messageFor } from '@/shared/api/errors';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { riskTone, UNKNOWN_RISK, DISPLAY_RISK_LABEL } from '@/shared/lib/risk';
import {
  Banner,
  Button,
  ErrorState,
  RiskGauge,
  Skeleton,
  SlaCountdown,
  TextAreaField,
  ToneBadge,
} from '@/shared/ui';

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

  // AI açıklama anlatısı — işlem kimliğinden lazy çekilir, backend'de cache'lenir.
  const transactionId = riskCase.data?.data.transaction.transactionId;
  const explanation = useQuery({
    queryKey: queryKeys.ai.explanationByTransaction(transactionId ?? ''),
    queryFn: () => getExplanationByTransaction(transactionId as string),
    enabled: Boolean(transactionId),
    staleTime: Infinity,
  });

  if (riskCase.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-96 w-full rounded-card" />
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      </div>
    );
  }
  if (riskCase.isError) {
    return <ErrorState error={riskCase.error} onRetry={() => void riskCase.refetch()} />;
  }

  const item = riskCase.data.data;
  const level = item.effectiveRisk.riskLevel ?? UNKNOWN_RISK;
  const tone = riskTone(level);
  const canReview = item.status === 'ATANDI';
  const canDecide = item.status === 'INCELENIYOR';

  return (
    <div>
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/analyst"
          aria-label="Vakalara dön"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-700 shadow-card"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-h1 text-ink-900">{item.transaction.transactionNo}</h1>
          <p className="text-caption text-ink-500">Vaka #{item.caseId.slice(0, 8)}</p>
        </div>
        <SlaCountdown sla={item.sla} className="ml-auto" />
      </header>

      {actionError ? (
        <Banner tone="danger" className="mb-4">
          {actionError}
        </Banner>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Sol / orta — vaka bilgisi ve AI */}
        <div className="space-y-6">
          <section className="surface-panel relative overflow-hidden p-6" aria-labelledby="case-title">
            <span className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} aria-hidden />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="case-title" className="text-h3 text-ink-900">
                    Vaka özeti
                  </h2>
                  <ToneBadge toneClass={tone.chip}>{DISPLAY_RISK_LABEL[level]}</ToneBadge>
                  {item.effectiveRisk.overridden && (
                    <ToneBadge toneClass="bg-brand-100 text-brand-700">Override</ToneBadge>
                  )}
                </div>
                <p className="mt-4 text-3xl font-bold tabular text-ink-900">
                  {formatMoney(item.transaction.amount, item.transaction.currency)}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-500">
                  {CASE_STATUS_LABEL[item.status]}
                </p>
              </div>
              <RiskGauge score={item.effectiveRisk.riskScore} level={level} size="lg" />
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-ink-100 pt-5 text-sm">
              <div>
                <dt className="text-ink-500">Risk tipi</dt>
                <dd className="mt-1 font-semibold text-ink-900">
                  {item.effectiveRisk.fraudType
                    ? FRAUD_TYPE_LABEL[item.effectiveRisk.fraudType]
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-ink-500">
                  <MapPin className="size-4" /> Konum
                </dt>
                <dd className="mt-1 font-medium text-ink-900">
                  {item.transaction.city}, {item.transaction.countryCode}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Alıcı</dt>
                <dd className="mt-1 break-all font-medium text-ink-900">
                  {item.transaction.recipientReference}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-ink-500">
                  <Clock3 className="size-4" /> İşlem zamanı
                </dt>
                <dd className="mt-1 font-medium text-ink-900">
                  {formatDateTime(item.transaction.occurredAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="surface-panel p-6" aria-labelledby="ai-title">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-tile bg-brand-100 text-brand-700">
                <Bot className="size-4.5" aria-hidden />
              </span>
              <h2 id="ai-title" className="text-h3 text-ink-900">
                Yapay zekâ açıklaması
              </h2>
              {explanation.data?.source === 'deterministic' ? (
                <span className="rounded-full bg-canvas px-2 py-0.5 text-micro font-medium text-ink-500">
                  Otomatik özet
                </span>
              ) : null}
            </div>
            {explanation.isPending ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : explanation.isError ? (
              <p className="mt-3 text-sm text-ink-500">Açıklama şu anda yüklenemedi.</p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-700">
                {explanation.data?.explanation}
              </p>
            )}
          </section>
        </div>

        {/* Sağ — yapışkan karar paneli */}
        <section aria-labelledby="action-title" className="lg:sticky lg:top-24">
          <div className="surface-panel p-6">
            <h2 id="action-title" className="text-h3 text-ink-900">
              İnceleme
            </h2>

            {canReview ? (
              <div className="mt-4">
                <p className="mb-4 text-sm text-ink-500">
                  Karar verebilmek için önce incelemeyi başlat. Bu adım SLA sayacını sürdürür.
                </p>
                <Button
                  fullWidth
                  loading={review.isPending}
                  onClick={() => {
                    setActionError(null);
                    review.mutate();
                  }}
                  leadingIcon={<Play className="size-4" />}
                >
                  İncelemeyi başlat
                </Button>
              </div>
            ) : null}

            {canDecide ? (
              <div className="mt-4 space-y-4">
                <TextAreaField
                  label="Karar notu"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  hint="Blok kararında not zorunludur."
                />
                <div className="grid gap-2.5">
                  <Button
                    variant="secondary"
                    fullWidth
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
                    fullWidth
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
              </div>
            ) : null}

            {item.status === 'MUSTERI_DOGRULAMA' ? (
              <p className="mt-4 rounded-tile bg-canvas p-3.5 text-sm text-ink-600" role="status">
                Müşteriden doğrulama bekleniyor.
              </p>
            ) : null}

            {customerAnswer ? (
              <p className="mt-4 rounded-tile bg-canvas p-3.5 text-sm text-ink-700" data-testid="customer-answer">
                Müşteri cevabı:{' '}
                <strong>
                  {customerAnswer.reason?.includes('NOT_MINE') ? 'Ben yapmadım' : 'Ben yaptım'}
                </strong>
              </p>
            ) : null}

            {canDecide && !customerAnswer ? (
              <Button
                className="mt-4"
                variant="secondary"
                fullWidth
                loading={verification.isPending}
                onClick={() => {
                  setActionError(null);
                  verification.mutate();
                }}
              >
                Müşteriden doğrulama iste
              </Button>
            ) : null}

            {!canReview && !canDecide && item.status !== 'MUSTERI_DOGRULAMA' ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-tile bg-canvas p-3.5 text-sm text-ink-600">
                <Send className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                <span>Bu vaka için aktif bir analist işlemi bulunmuyor.</span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
