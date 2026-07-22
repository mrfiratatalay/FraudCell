import { Link } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, Ban, Clock, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatMoney, formatRelative } from '@/shared/lib/format';
import { DISPLAY_RISK_LABEL, riskTone } from '@/shared/lib/risk';
import { ToneBadge } from '@/shared/ui';
import { TRANSACTION_TYPE_LABEL, type TransactionType } from '@/shared/api/enums';
import type { TransactionListItemResponse } from '@/shared/api/contract';

const TYPE_ICON: Record<TransactionType, typeof ArrowUpRight> = {
  ODEME: ArrowUpRight,
  TRANSFER: ArrowUpRight,
  FATURA: FileText,
  CEKIM: ArrowDownLeft,
};

/**
 * İşlem listesi satırı.
 *
 * Değerlendirme sürerken risk rozeti yerine "Değerlendiriliyor" gösterilir —
 * uydurma bir skor ya da yanıltıcı "düşük risk" gösterilmez (doküman §2, §21).
 */
export function TransactionRow({ tx }: { tx: TransactionListItemResponse }) {
  const Icon = TYPE_ICON[tx.transactionType];
  const pending = tx.assessmentStatus === 'PENDING';
  const blocked =
    tx.controlStatus === 'BLOCKED' || tx.controlStatus === 'TEMPORARILY_BLOCKED';
  const tone = riskTone(tx.displayRiskLevel);

  return (
    <Link
      to="/customer/transactions/$transactionId"
      params={{ transactionId: tx.transactionId }}
      className={cn(
        'surface-card flex items-center gap-3 p-4 transition-shadow',
        'hover:shadow-raised focus-visible:shadow-raised',
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-tile',
          blocked ? 'bg-critical-100 text-critical-700' : 'bg-brand-100 text-brand-700',
        )}
        aria-hidden
      >
        {blocked ? <Ban className="size-5" /> : <Icon className="size-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink-900">
          {TRANSACTION_TYPE_LABEL[tx.transactionType]}
        </p>
        <p className="mt-0.5 truncate text-sm text-ink-500">
          {tx.transactionNo} · {formatRelative(tx.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[15px] font-semibold tabular text-ink-900">
          {formatMoney(tx.amount, tx.currency)}
        </span>

        {pending ? (
          <ToneBadge toneClass="bg-ink-100 text-ink-500">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Değerlendiriliyor
          </ToneBadge>
        ) : blocked ? (
          <ToneBadge toneClass="bg-critical-100 text-critical-700">
            <Ban className="size-3" aria-hidden />
            Bloklu
          </ToneBadge>
        ) : (
          <ToneBadge toneClass={tone.chip}>{DISPLAY_RISK_LABEL[tx.displayRiskLevel]}</ToneBadge>
        )}
      </div>
    </Link>
  );
}

/** Bekleyen doğrulama uyarı satırı — ana sayfada ve doğrulama listesinde. */
export function PendingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <ToneBadge toneClass="bg-warning-100 text-warning-700">
      <Clock className="size-3" aria-hidden />
      {count} bekleyen
    </ToneBadge>
  );
}
