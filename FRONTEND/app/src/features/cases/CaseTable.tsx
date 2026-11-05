import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { CaseResponse } from '@/shared/api/contract';
import { CASE_STATUS_LABEL, FRAUD_TYPE_LABEL, TRANSACTION_TYPE_LABEL, type CaseStatus } from '@/shared/api/enums';
import { cn } from '@/shared/lib/cn';
import { formatMoney, formatRelative } from '@/shared/lib/format';
import { RiskScore, SlaCountdown } from '@/shared/ui';

const STATUS_DOT: Record<CaseStatus, string> = {
  YENI: 'bg-brand-500',
  ATANDI: 'bg-ink-400',
  INCELENIYOR: 'bg-brand-500',
  MUSTERI_DOGRULAMA: 'bg-warning-500',
  ONAYLANDI: 'bg-success-500',
  BLOKLANDI: 'bg-critical-500',
  KAPANDI: 'bg-ink-300',
};

export function CaseStatusLabel({ status, className }: { status: CaseStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-700', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[status])} aria-hidden />
      {CASE_STATUS_LABEL[status]}
    </span>
  );
}

type CaseLink = '/analyst/cases/$caseId' | '/supervisor/cases/$caseId';

export interface CaseTableColumn {
  header: string;
  cell: (item: CaseResponse) => ReactNode;
}

const GRID = 'lg:grid-cols-[8.5rem_minmax(12rem,1.6fr)_8.5rem_9.5rem_7.5rem_minmax(6rem,0.8fr)]';
const GRID_EXTRA = 'lg:grid-cols-[8.5rem_minmax(12rem,1.6fr)_8.5rem_9.5rem_7.5rem_minmax(8rem,1fr)_minmax(6rem,0.8fr)]';

/**
 * The case list every role works from: one row per case, riskiest first as
 * the API returns it. Each row is a single link to the case; on a phone the
 * columns fold into two lines.
 */
export function CaseTable({
  items,
  to,
  extra,
  label = 'Vakalar',
}: {
  items: CaseResponse[];
  to: CaseLink;
  /** One optional column before "Açıldı" (e.g. the assigned analyst). */
  extra?: CaseTableColumn;
  label?: string;
}) {
  const grid = extra ? GRID_EXTRA : GRID;
  return (
    <div className="surface-panel overflow-hidden">
      <div
        className={cn(
          'hidden border-b border-line bg-subtle px-4 py-2.5 text-xs font-medium text-ink-500 lg:grid lg:gap-4',
          grid,
        )}
        aria-hidden
      >
        <span>Risk</span>
        <span>İşlem</span>
        <span className="text-right">Tutar</span>
        <span>Durum</span>
        <span>SLA</span>
        {extra && <span>{extra.header}</span>}
        <span className="text-right">Açıldı</span>
      </div>

      <ul aria-label={label} className="divide-y divide-line">
        {items.map((item) => {
          const type = item.effectiveRisk.fraudType
            ? FRAUD_TYPE_LABEL[item.effectiveRisk.fraudType]
            : TRANSACTION_TYPE_LABEL[item.transaction.transactionType];
          return (
            <li key={item.caseId}>
              <Link
                to={to}
                params={{ caseId: item.caseId }}
                className={cn(
                  'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-subtle focus-visible:bg-subtle lg:gap-y-0 lg:py-3',
                  grid,
                )}
              >
                <RiskScore
                  level={item.effectiveRisk.riskLevel}
                  score={item.effectiveRisk.riskScore}
                  className="order-3 lg:order-none"
                />
                <span className="order-1 min-w-0 lg:order-none">
                  <span className="block truncate font-mono text-[13px] font-medium text-ink-900">
                    {item.transaction.transactionNo}
                  </span>
                  <span className="block truncate text-[13px] text-ink-500">
                    {type} · {item.transaction.city}, {item.transaction.countryCode}
                  </span>
                </span>
                <span className="order-4 text-right text-sm font-semibold text-ink-900 tabular lg:order-none">
                  {formatMoney(item.transaction.amount, item.transaction.currency)}
                </span>
                <CaseStatusLabel status={item.status} className="order-5 lg:order-none" />
                <span className="order-2 justify-self-end lg:order-none lg:justify-self-start">
                  <SlaCountdown sla={item.sla} compact />
                </span>
                {extra && <span className="order-6 min-w-0 truncate text-[13px] text-ink-700 lg:order-none">{extra.cell(item)}</span>}
                <span className="order-6 justify-self-end text-xs text-ink-500 lg:order-none">
                  {formatRelative(item.createdAt)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
