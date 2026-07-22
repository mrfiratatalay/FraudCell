import type { ColumnDef } from '@tanstack/react-table';
import type { CaseResponse } from '@/shared/api/contract';
import { ASSIGNMENT_STATUS_LABEL, CASE_STATUS_LABEL } from '@/shared/api/enums';
import { Badge, RiskBar, SlaCountdown } from '@/shared/ui';
import { formatMoney } from '@/shared/lib/format';
import { caseStatusTone, toDisplayRisk } from '../view';

/**
 * Süpervizörün "Tüm vakalar" ekranı — analist ekranındaki kolonlara ek
 * olarak atama durumunu ve atanan analisti gösterir (süpervizör kimin
 * elinde olduğunu görmek zorunda, analist bunu görmez).
 */
export const allCasesColumns: ColumnDef<CaseResponse>[] = [
  {
    id: 'transactionNo',
    header: 'İşlem No',
    accessorFn: (row) => row.transaction.transactionNo,
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
  },
  {
    id: 'amount',
    header: 'Tutar',
    accessorFn: (row) => row.transaction,
    cell: ({ getValue }) => {
      const tx = getValue<CaseResponse['transaction']>();
      return <span className="font-semibold">{formatMoney(tx.amount, tx.currency)}</span>;
    },
  },
  {
    id: 'risk',
    header: 'Risk',
    accessorFn: (row) => row.effectiveRisk,
    cell: ({ getValue }) => {
      const risk = getValue<CaseResponse['effectiveRisk']>();
      return <RiskBar score={risk.riskScore} level={toDisplayRisk(risk)} className="w-32" />;
    },
  },
  {
    id: 'status',
    header: 'Durum',
    accessorFn: (row) => row.status,
    cell: ({ getValue }) => {
      const status = getValue<CaseResponse['status']>();
      return <Badge tone={caseStatusTone(status)}>{CASE_STATUS_LABEL[status]}</Badge>;
    },
  },
  {
    id: 'assignment',
    header: 'Atama',
    accessorFn: (row) => row,
    cell: ({ getValue }) => {
      const c = getValue<CaseResponse>();
      return (
        <div className="text-xs text-ink-500">
          <p>{ASSIGNMENT_STATUS_LABEL[c.assignmentStatus]}</p>
          {c.assignedAnalystId && <p className="font-mono">{c.assignedAnalystId}</p>}
        </div>
      );
    },
  },
  {
    id: 'sla',
    header: 'SLA',
    accessorFn: (row) => row.sla,
    cell: ({ getValue }) => <SlaCountdown sla={getValue<CaseResponse['sla']>()} compact />,
  },
];
