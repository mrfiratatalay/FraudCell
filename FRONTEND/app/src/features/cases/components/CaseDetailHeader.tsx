import type { CaseResponse } from '@/shared/api/contract';
import { Badge, Card, CardHeader, RiskGauge, SlaCountdown } from '@/shared/ui';
import { CASE_STATUS_LABEL, TRANSACTION_TYPE_LABEL } from '@/shared/api/enums';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { caseStatusTone, toDisplayRisk } from '../view';

export function CaseDetailHeader({ c }: { c: CaseResponse }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardHeader
            title={c.transaction.transactionNo}
            subtitle={`${TRANSACTION_TYPE_LABEL[c.transaction.transactionType]} · ${formatMoney(
              c.transaction.amount,
              c.transaction.currency,
            )}`}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={caseStatusTone(c.status)}>{CASE_STATUS_LABEL[c.status]}</Badge>
            <SlaCountdown sla={c.sla} />
            {c.effectiveRisk.overridden && <Badge tone="warning">Override edildi</Badge>}
          </div>

          <p className="mt-3 text-sm text-ink-500">
            {c.transaction.city}, {c.transaction.countryCode} · {formatDateTime(c.transaction.occurredAt)}
          </p>

          {c.finalDecision && (
            <p className="mt-1 text-sm text-ink-700">
              Karar: {c.finalDecision === 'APPROVE' ? 'Onaylandı' : 'Bloklandı'}
              {c.decisionNote ? ` — ${c.decisionNote}` : ''}
            </p>
          )}
        </div>

        <RiskGauge score={c.effectiveRisk.riskScore} level={toDisplayRisk(c.effectiveRisk)} size="lg" />
      </div>
    </Card>
  );
}
