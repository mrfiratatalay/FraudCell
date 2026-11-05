import { Link } from '@tanstack/react-router';
import { ArrowLeftRight, CreditCard, Smartphone, Wallet } from 'lucide-react';
import type { TransactionListItemResponse } from '@/shared/api/contract';
import { TRANSACTION_TYPE_LABEL, type TransactionType } from '@/shared/api/enums';
import { cn } from '@/shared/lib/cn';
import { formatMoney, formatRelative } from '@/shared/lib/format';

/**
 * What the customer needs to know about a transaction is whether it went
 * through, not the model's risk level — so the list speaks in outcomes.
 */
export function customerStatus(
  item: Pick<TransactionListItemResponse, 'assessmentStatus' | 'controlStatus'> & {
    screeningDecision?: TransactionListItemResponse['screeningDecision'] | null;
    caseStatus?: string | null;
  },
): {
  label: string;
  className: string;
} {
  if (item.assessmentStatus !== 'COMPLETED' && item.controlStatus === 'ALLOWED') {
    return { label: 'Değerlendiriliyor', className: 'bg-ink-100 text-ink-600 ring-ink-400/20' };
  }
  // Sent to review but no decision yet: still with an analyst.
  const reviewOpen =
    item.controlStatus === 'ALLOWED' &&
    item.screeningDecision !== 'ONAY' &&
    item.screeningDecision != null &&
    item.caseStatus !== 'KAPANDI' &&
    item.caseStatus !== 'ONAYLANDI';
  if (reviewOpen) {
    return { label: 'İncelemede', className: 'bg-warning-100 text-warning-700 ring-warning-500/25' };
  }
  switch (item.controlStatus) {
    case 'TEMPORARILY_BLOCKED':
      return { label: 'İncelemede', className: 'bg-warning-100 text-warning-700 ring-warning-500/25' };
    case 'BLOCKED':
      return { label: 'Engellendi', className: 'bg-critical-100 text-critical-700 ring-critical-500/25' };
    case 'APPROVED':
      return { label: 'Onaylandı', className: 'bg-success-100 text-success-700 ring-success-500/20' };
    default:
      return { label: 'Tamamlandı', className: 'bg-success-100 text-success-700 ring-success-500/20' };
  }
}

const TYPE_ICON: Partial<Record<TransactionType, typeof CreditCard>> = {
  TRANSFER: ArrowLeftRight,
  ODEME: Wallet,
  CEKIM: Wallet,
  FATURA: Smartphone,
};

export function TransactionStatus({ item, className }: { item: TransactionListItemResponse; className?: string }) {
  const status = customerStatus(item);
  return (
    <span className={cn('inline-flex h-6 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset', status.className, className)}>
      {status.label}
    </span>
  );
}

export function TransactionList({ items, label }: { items: TransactionListItemResponse[]; label: string }) {
  return (
    <ul aria-label={label} className="surface-panel divide-y divide-line overflow-hidden">
      {items.map((item) => {
        const Icon = TYPE_ICON[item.transactionType] ?? CreditCard;
        return (
          <li key={item.transactionId}>
            <Link
              to="/customer/transactions/$transactionId"
              params={{ transactionId: item.transactionId }}
              className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-subtle sm:px-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {TRANSACTION_TYPE_LABEL[item.transactionType]}
                </span>
                <span className="block truncate text-xs text-ink-500">
                  <span className="font-mono">{item.transactionNo}</span> · {formatRelative(item.createdAt)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-ink-900 tabular">{formatMoney(item.amount, item.currency)}</span>
                <TransactionStatus item={item} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
