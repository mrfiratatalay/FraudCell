import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { AssignmentQueueItemResponse } from '@/shared/api/contract';
import { Badge, Button, ToneBadge } from '@/shared/ui';
import { formatCountdown } from '@/shared/lib/format';
import { DISPLAY_RISK_LABEL, riskTone } from '@/shared/lib/risk';
import { cn } from '@/shared/lib/cn';

/**
 * Kuyruk satırının SLA'sı — `SlaCountdown` bileşeni tam `CaseSlaResponse`
 * bekliyor (status/remainingSeconds dahil); `AssignmentQueueItemResponse` yalnızca
 * düz `slaDeadlineAt` taşıyor. Diğer dört ekranda kullanılan bileşenin sözleşmesini
 * bozmamak için burada küçük, yerel bir hücre kullanılır.
 */
function QueueSlaCell({ deadlineAt }: { deadlineAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  const deadline = new Date(deadlineAt).getTime();
  const breached = now >= deadline;

  useEffect(() => {
    if (breached) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [breached]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold tabular whitespace-nowrap',
        breached ? 'bg-critical-100 text-critical-700' : 'bg-ink-100 text-ink-500',
      )}
    >
      <Timer className="size-3.5" aria-hidden />
      {breached ? 'SLA aşıldı' : formatCountdown(deadline - now)}
    </span>
  );
}

/** `onAssign` her satırın "Ata" butonuna bağlanır — statik kolon dizisi değil, fabrika. */
export function buildQueueColumns(
  onAssign: (item: AssignmentQueueItemResponse) => void,
): ColumnDef<AssignmentQueueItemResponse>[] {
  return [
    {
      id: 'transactionNo',
      header: 'İşlem No',
      accessorKey: 'transactionNo',
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    },
    {
      id: 'risk',
      header: 'Risk',
      accessorKey: 'displayRiskLevel',
      cell: ({ getValue }) => {
        const level = getValue<AssignmentQueueItemResponse['displayRiskLevel']>();
        return <ToneBadge toneClass={riskTone(level).chip}>{DISPLAY_RISK_LABEL[level]}</ToneBadge>;
      },
    },
    {
      id: 'manualReviewReason',
      header: 'Sebep',
      accessorKey: 'manualReviewReason',
      cell: ({ getValue }) => {
        const reason = getValue<string | null>();
        return reason ? (
          <span className="text-xs text-ink-500">{reason}</span>
        ) : (
          <Badge tone="neutral">Kapasite bekliyor</Badge>
        );
      },
    },
    {
      id: 'sla',
      header: 'SLA',
      accessorKey: 'slaDeadlineAt',
      cell: ({ getValue }) => <QueueSlaCell deadlineAt={getValue<string>()} />,
    },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" onClick={() => onAssign(row.original)}>
          Ata
        </Button>
      ),
    },
  ];
}
