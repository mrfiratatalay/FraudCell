import type { ColumnDef } from '@tanstack/react-table';
import type { CaseResponse } from '@/shared/api/contract';
import { CASE_STATUS_LABEL } from '@/shared/api/enums';
import { Badge, RiskBar, SlaCountdown } from '@/shared/ui';
import { formatMoney } from '@/shared/lib/format';
import { caseStatusTone, toDisplayRisk } from '../view';

export const assignedColumns: ColumnDef<CaseResponse>[] = [
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
      return (
        <RiskBar score={risk.riskScore} level={toDisplayRisk(risk)} className="w-32" />
      );
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
    id: 'sla',
    header: 'SLA',
    accessorFn: (row) => row.sla,
    cell: ({ getValue }) => <SlaCountdown sla={getValue<CaseResponse['sla']>()} compact />,
  },
];
