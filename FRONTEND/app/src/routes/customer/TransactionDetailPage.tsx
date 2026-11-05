import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Bot, Clock3, MapPin, Send } from 'lucide-react';
import { CaseFeedbackCard } from '@/features/cases/CaseFeedbackCard';
import { getTransaction } from '@/features/transactions/api';
import {
  ASSESSMENT_STATUS_LABEL,
  CONTROL_STATUS_LABEL,
  FRAUD_TYPE_LABEL,
  SCREENING_DECISION_LABEL,
  TRANSACTION_TYPE_LABEL,
} from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { displayRisk } from '@/shared/lib/risk';
import { Banner, ErrorState, ReasonCodeList, RiskGauge, Skeleton } from '@/shared/ui';

/** Kontrol durumuna göre banner tonu — bloklu işlemler kırmızı uyarı taşır. */
const CONTROL_TONE = {
  ALLOWED: null,
  APPROVED: 'success',
  TEMPORARILY_BLOCKED: 'warning',
  BLOCKED: 'danger',
} as const;

export function TransactionDetailPage({ transactionId }: { transactionId: string }) {
  const transaction = useQuery({
    queryKey: queryKeys.transactions.detail(transactionId),
    queryFn: () => getTransaction(transactionId),
    refetchInterval: (query) =>
      query.state.data?.assessment.status === 'PENDING' || !query.state.data ? 750 : false,
  });

  if (transaction.isPending) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6 lg:max-w-6xl lg:px-6 lg:py-8" role="status" aria-label="Yükleniyor">
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
  const riskLevel = displayRisk(assessment.status, assessment.riskLevel);
  const controlTone = CONTROL_TONE[item.controlStatus];

  return (
    <div className="mx-auto max-w-lg px-4 py-6 lg:max-w-6xl lg:px-6 lg:py-8 xl:px-8">
      <header className="mb-5 flex items-center gap-3">
        <Link
          to="/customer/transactions"
          aria-label="İşlemlere dön"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-700 shadow-card"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-h2 text-ink-900">{item.transactionNo}</h1>
          <p className="text-sm text-ink-500">{TRANSACTION_TYPE_LABEL[item.transactionType]}</p>
        </div>
      </header>

      {assessment.status === 'PENDING' ? (
        <Banner className="mb-4">
          İşlem alındı. AI risk değerlendirmesi tamamlandığında bu ekran otomatik güncellenecek.
        </Banner>
      ) : null}
      {assessment.status === 'TIMED_OUT' || assessment.status === 'FAILED' ? (
        <Banner tone="warning" className="mb-4">
          Otomatik değerlendirme tamamlanamadı; işlem güvenli biçimde manuel incelemeye
          yönlendirildi.
        </Banner>
      ) : null}
      {controlTone ? (
        <Banner tone={controlTone} className="mb-4">
          Kontrol durumu: <strong>{CONTROL_STATUS_LABEL[item.controlStatus]}</strong>
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk kahramanı */}
        <section
          className="surface-card flex items-center justify-between gap-5 p-5"
          aria-labelledby="risk-title"
        >
        <div className="min-w-0">
          <p className="text-sm text-ink-500">İşlem tutarı</p>
          <p className="mt-1 text-2xl font-bold tabular text-ink-900">
            {formatMoney(item.amount, item.currency)}
          </p>
          <p id="risk-title" className="mt-4 text-sm font-semibold text-ink-900">
            {ASSESSMENT_STATUS_LABEL[assessment.status]}
          </p>
          <p className="mt-1 text-xs text-ink-500">{CONTROL_STATUS_LABEL[item.controlStatus]}</p>
        </div>
        <RiskGauge score={assessment.riskScore} level={riskLevel} size="lg" />
        </section>

      {/* İşlem bilgileri */}
      <section className="surface-card p-5" aria-labelledby="details-title">
        <h2 id="details-title" className="text-h3 text-ink-900">
          İşlem bilgileri
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-ink-500">
              <Clock3 className="size-4" /> Zaman
            </dt>
            <dd className="mt-1 font-medium text-ink-900">{formatDateTime(item.occurredAt)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-ink-500">
              <MapPin className="size-4" /> Konum
            </dt>
            <dd className="mt-1 font-medium text-ink-900">
              {item.location.city}, {item.location.countryCode}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="flex items-center gap-1.5 text-ink-500">
              <Send className="size-4" /> Alıcı
            </dt>
            <dd className="mt-1 break-all font-medium text-ink-900">{item.recipient.reference}</dd>
          </div>
        </dl>
      </section>

      {/* AI değerlendirmesi */}
      {assessment.status === 'COMPLETED' ? (
        <section className="surface-card p-5 lg:col-span-2" aria-labelledby="assessment-title">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-tile bg-brand-100 text-brand-700">
              <Bot className="size-4.5" aria-hidden />
            </span>
            <h2 id="assessment-title" className="text-h3 text-ink-900">
              Yapay zekâ değerlendirmesi
            </h2>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-ink-500">Karar</dt>
              <dd className="mt-1 font-semibold text-ink-900">
                {assessment.screeningDecision
                  ? SCREENING_DECISION_LABEL[assessment.screeningDecision]
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">Risk tipi</dt>
              <dd className="mt-1 font-semibold text-ink-900">
                {assessment.fraudType ? FRAUD_TYPE_LABEL[assessment.fraudType] : '—'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-500">Model</dt>
              <dd className="mt-1 font-mono text-xs text-ink-700">
                {assessment.modelVersion ?? '—'}
              </dd>
            </div>
          </dl>

          {assessment.reasonCodes.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2.5 text-caption font-semibold text-ink-500">Değerlendirme gerekçeleri</p>
              <ReasonCodeList reasons={assessment.reasonCodes} />
            </div>
          ) : null}
        </section>
      ) : null}

      {item.caseId && item.caseStatus === 'KAPANDI' ? (
        <CaseFeedbackCard
          transactionId={item.transactionId}
          caseId={item.caseId}
          rating={item.feedbackRating}
        />
      ) : null}
      </div>
    </div>
  );
}
