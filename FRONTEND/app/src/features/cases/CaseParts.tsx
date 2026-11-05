import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { getExplanationByTransaction } from '@/features/ai/api';
import { getCaseHistory } from '@/features/cases/api';
import type { CaseResponse } from '@/shared/api/contract';
import {
  CASE_STATUS_LABEL,
  FRAUD_TYPE_LABEL,
  TRANSACTION_TYPE_LABEL,
  TRANSITION_SOURCE_LABEL,
} from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { cn } from '@/shared/lib/cn';
import { formatDateTime, formatMoney, formatScore } from '@/shared/lib/format';
import { DISPLAY_RISK_LABEL, riskTone, UNKNOWN_RISK } from '@/shared/lib/risk';
import { RiskMeter, Skeleton, SlaCountdown, Timeline, ToneBadge } from '@/shared/ui';
import { CaseStatusLabel } from './CaseTable';

/* ----------------------------------------------------------------- header -- */

/** Case title row. The top bar's breadcrumb is the way back to the list. */
export function CaseHeader({ item, actions }: { item: CaseResponse; actions?: ReactNode }) {
  const level = item.effectiveRisk.riskLevel ?? UNKNOWN_RISK;
  const tone = riskTone(level);
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="font-mono text-[1.375rem] font-semibold tracking-[-0.02em] text-ink-900 sm:text-2xl">
          {item.transaction.transactionNo}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <ToneBadge toneClass={tone.chip}>{DISPLAY_RISK_LABEL[level]} risk</ToneBadge>
          {item.effectiveRisk.overridden && <ToneBadge toneClass="bg-brand-50 text-brand-700">Süpervizör düzeltmesi</ToneBadge>}
          <CaseStatusLabel status={item.status} className="ml-1" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SlaCountdown sla={item.sla} />
          {actions}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ facts -- */

export function CaseFacts({ item }: { item: CaseResponse }) {
  const facts: { label: string; value: ReactNode; mono?: boolean }[] = [
    { label: 'Tutar', value: formatMoney(item.transaction.amount, item.transaction.currency) },
    { label: 'İşlem türü', value: TRANSACTION_TYPE_LABEL[item.transaction.transactionType] },
    { label: 'Konum', value: `${item.transaction.city}, ${item.transaction.countryCode}` },
    { label: 'Alıcı', value: item.transaction.recipientReference, mono: true },
    { label: 'İşlem zamanı', value: formatDateTime(item.transaction.occurredAt) },
  ];
  return (
    <dl className="surface-panel grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {facts.map((fact, index) => (
        <div key={fact.label} className={cn('min-w-0 px-4 py-3.5', index === 0 && 'col-span-2 sm:col-span-1')}>
          <dt className="text-xs text-ink-500">{fact.label}</dt>
          <dd
            className={cn(
              'mt-1 truncate text-ink-900',
              index === 0 ? 'text-lg font-semibold tabular' : 'text-sm font-medium',
              fact.mono && 'font-mono text-[13px]',
            )}
            title={typeof fact.value === 'string' ? fact.value : undefined}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------------------------------------- risk/AI -- */

export function RiskAssessmentPanel({ item }: { item: CaseResponse }) {
  const level = item.effectiveRisk.riskLevel ?? UNKNOWN_RISK;
  const tone = riskTone(level);
  const transactionId = item.transaction.transactionId;
  const explanation = useQuery({
    queryKey: queryKeys.ai.explanationByTransaction(transactionId),
    queryFn: () => getExplanationByTransaction(transactionId),
    staleTime: Infinity,
  });

  return (
    <section className="surface-panel p-5" aria-labelledby="risk-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="risk-title" className="text-h3 text-ink-900">
            Risk değerlendirmesi
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {item.effectiveRisk.fraudType ? FRAUD_TYPE_LABEL[item.effectiveRisk.fraudType] : 'Tür belirlenmedi'}
            {item.effectiveRisk.overridden ? ' · süpervizör tarafından düzeltildi' : ' · yapay zekâ modeli'}
          </p>
        </div>
        <div className="text-right">
          <p className={cn('font-mono text-[2rem] leading-none font-medium tabular', tone.text)}>
            {item.effectiveRisk.riskScore == null ? '—' : formatScore(item.effectiveRisk.riskScore)}
          </p>
          <p className="mt-1 text-xs text-ink-500">risk skoru</p>
        </div>
      </div>

      <RiskMeter level={item.effectiveRisk.riskLevel} score={item.effectiveRisk.riskScore} className="mt-5" />

      <div className="mt-6 rounded-lg bg-subtle p-4 ring-1 ring-line">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
          <Sparkles className="size-3.5 text-brand-600" aria-hidden />
          Yapay zekâ açıklaması
          {explanation.data?.source === 'deterministic' ? <span className="font-normal">· kural tabanlı özet</span> : null}
        </p>
        {explanation.isPending ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ) : explanation.isError ? (
          <p className="mt-2 text-sm text-ink-500">Açıklama şu anda yüklenemedi.</p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-ink-800">{explanation.data.explanation}</p>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- history -- */

export function CaseHistoryPanel({ caseId, createdAt }: { caseId: string; createdAt: string }) {
  const history = useQuery({
    queryKey: queryKeys.cases.history(caseId),
    queryFn: () => getCaseHistory(caseId),
  });

  return (
    <section className="surface-panel p-5" aria-labelledby="history-title">
      <h2 id="history-title" className="text-h3 text-ink-900">
        Vaka geçmişi
      </h2>
      <div className="mt-4">
        {history.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : history.isError ? (
          <p className="text-sm text-ink-500">Geçmiş yüklenemedi.</p>
        ) : (
          <Timeline
            entries={[
              {
                id: 'opened',
                title: 'Vaka açıldı',
                meta: formatDateTime(createdAt),
                description: 'Yapay zekâ incelemeye gönderdi',
                dotClass: 'bg-ink-100 text-ink-500',
              },
              ...history.data.map((entry) => ({
                id: entry.id,
                title: CASE_STATUS_LABEL[entry.newStatus],
                meta: formatDateTime(entry.occurredAt),
                description: [TRANSITION_SOURCE_LABEL[entry.transitionSource], entry.reason]
                  .filter(Boolean)
                  .join(' · '),
                dotClass:
                  entry.newStatus === 'BLOKLANDI'
                    ? 'bg-critical-100 text-critical-600'
                    : entry.newStatus === 'ONAYLANDI'
                      ? 'bg-success-100 text-success-600'
                      : 'bg-brand-50 text-brand-600',
              })),
            ]}
          />
        )}
      </div>
    </section>
  );
}
