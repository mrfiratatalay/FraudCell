import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, X } from 'lucide-react';
import { customerStatus } from '@/features/transactions/TransactionList';
import { cn } from '@/shared/lib/cn';
import { CaseFeedbackCard } from '@/features/cases/CaseFeedbackCard';
import { getTransaction } from '@/features/transactions/api';
import {
  FRAUD_TYPE_LABEL,
  SCREENING_DECISION_LABEL,
  TRANSACTION_TYPE_LABEL,
} from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { ErrorState, ReasonCodeList, RiskMeter, Skeleton } from '@/shared/ui';

export function TransactionDetailPage({ transactionId }: { transactionId: string }) {
  const transaction = useQuery({
    queryKey: queryKeys.transactions.detail(transactionId),
    queryFn: () => getTransaction(transactionId),
    refetchInterval: (query) =>
      query.state.data?.assessment.status === 'PENDING' || !query.state.data ? 750 : false,
  });

  if (transaction.isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:py-10" role="status" aria-label="Yükleniyor">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    );
  }

  if (transaction.isError) {
    return <ErrorState error={transaction.error} onRetry={() => void transaction.refetch()} />;
  }

  const item = transaction.data;
  const assessment = item.assessment;
  const status = customerStatus({
    assessmentStatus: assessment.status,
    controlStatus: item.controlStatus,
    screeningDecision: assessment.screeningDecision,
    caseStatus: item.caseId ? item.caseStatus : 'KAPANDI',
  });
  const assessed = assessment.status === 'COMPLETED';
  const inReview = status.label === 'İncelemede';
  const reviewed = Boolean(item.caseId);
  const finished = item.controlStatus !== 'TEMPORARILY_BLOCKED' && assessment.status !== 'PENDING';
  const blocked = item.controlStatus === 'BLOCKED';

  const steps: { title: string; detail: string; state: 'done' | 'current' | 'skipped' | 'todo' | 'bad' }[] = [
    { title: 'İşlem alındı', detail: formatDateTime(item.occurredAt), state: 'done' },
    {
      title: 'Risk değerlendirmesi',
      detail: assessed
        ? `Yapay zekâ kararı: ${assessment.screeningDecision ? SCREENING_DECISION_LABEL[assessment.screeningDecision] : '—'}`
        : assessment.status === 'PENDING'
          ? 'Değerlendiriliyor…'
          : 'Otomatik değerlendirme yapılamadı; manuel incelemeye alındı',
      state: assessed ? 'done' : assessment.status === 'PENDING' ? 'current' : 'done',
    },
    {
      title: 'Analist incelemesi',
      detail: inReview ? 'Bir güvenlik analisti işlemi inceliyor' : reviewed ? 'İnceleme tamamlandı' : 'Gerekmedi',
      state: inReview ? 'current' : reviewed ? 'done' : finished ? 'skipped' : 'todo',
    },
    {
      title: blocked ? 'İşlem engellendi' : 'Sonuç',
      detail: blocked ? 'Hesabını korumak için işlem durduruldu' : finished ? 'İşlem tamamlandı' : 'Bekleniyor',
      state: blocked ? 'bad' : finished ? 'done' : 'todo',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <Link to="/customer/transactions" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-3.5" aria-hidden /> İşlemlerim
      </Link>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          {/* Receipt */}
          <section className="surface-panel p-5 sm:p-6" aria-labelledby="tx-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-ink-500">{TRANSACTION_TYPE_LABEL[item.transactionType]}</p>
                <p className="mt-1 text-[2rem] leading-none font-semibold tracking-[-0.03em] text-ink-900 tabular">
                  {formatMoney(item.amount, item.currency)}
                </p>
              </div>
              <span className={cn('inline-flex h-7 items-center rounded-md px-2.5 text-[13px] font-medium ring-1 ring-inset', status.className)}>
                {status.label}
              </span>
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-500">İşlem no</dt>
                <dd className="mt-1">
                  <h1 id="tx-title" className="font-mono text-[13px] font-medium text-ink-900">
                    {item.transactionNo}
                  </h1>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Zaman</dt>
                <dd className="mt-1 text-ink-900">{formatDateTime(item.occurredAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Konum</dt>
                <dd className="mt-1 text-ink-900">
                  {item.location.city}, {item.location.countryCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Alıcı</dt>
                <dd className="mt-1 font-mono text-[13px] break-all text-ink-900">{item.recipient.reference}</dd>
              </div>
            </dl>
          </section>

          {assessed ? (
            <section className="surface-panel p-5 sm:p-6" aria-labelledby="assessment-title">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="assessment-title" className="text-h3 text-ink-900">
                  Yapay zekâ değerlendirmesi
                </h2>
                <span className="font-mono text-[11px] text-ink-500">{assessment.modelVersion ?? ''}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-500">
                {assessment.fraudType ? FRAUD_TYPE_LABEL[assessment.fraudType] : 'Tür belirlenmedi'} ·{' '}
                {assessment.screeningDecision ? SCREENING_DECISION_LABEL[assessment.screeningDecision] : '—'}
              </p>
              <RiskMeter level={assessment.riskLevel} score={assessment.riskScore} className="mt-5" />
              {assessment.reasonCodes.length > 0 ? (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-medium text-ink-500">Neden bu skor?</p>
                  <ReasonCodeList reasons={assessment.reasonCodes} />
                </div>
              ) : null}
            </section>
          ) : null}

          {item.caseId && item.caseStatus === 'KAPANDI' ? (
            <CaseFeedbackCard transactionId={item.transactionId} caseId={item.caseId} rating={item.feedbackRating} />
          ) : null}
        </div>

        {/* Progress */}
        <aside className="surface-panel p-5 lg:sticky lg:top-20" aria-labelledby="progress-title">
          <h2 id="progress-title" className="text-h3 text-ink-900">
            İşlem süreci
          </h2>
          <ol className="mt-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                {index < steps.length - 1 && <span className="absolute top-5 bottom-0 left-[9px] w-px bg-line" aria-hidden />}
                <span
                  className={cn(
                    'relative mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full border-2',
                    step.state === 'done' && 'border-success-500 bg-success-500 text-white',
                    step.state === 'current' && 'border-tc-500 bg-tc-100',
                    step.state === 'bad' && 'border-critical-500 bg-critical-500 text-white',
                    (step.state === 'todo' || step.state === 'skipped') && 'border-ink-300 bg-surface',
                  )}
                  aria-hidden
                >
                  {step.state === 'done' ? <Check className="size-3" strokeWidth={3} /> : null}
                  {step.state === 'bad' ? <X className="size-3" strokeWidth={3} /> : null}
                  {step.state === 'current' ? <span className="size-1.5 animate-pulse rounded-full bg-tc-600" /> : null}
                </span>
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', step.state === 'todo' || step.state === 'skipped' ? 'text-ink-500' : 'text-ink-900')}>
                    {step.title}
                  </p>
                  <p className="text-xs text-ink-500">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          {item.controlStatus === 'TEMPORARILY_BLOCKED' ? (
            <Link
              to="/customer/verifications"
              className="mt-5 flex h-9 items-center justify-center rounded-control border border-line text-[13px] font-medium text-ink-900 hover:bg-subtle"
            >
              Bekleyen doğrulamalara git
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
