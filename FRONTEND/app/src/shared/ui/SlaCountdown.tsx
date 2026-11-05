import { useEffect, useState } from 'react';
import { Timer, TriangleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatCountdown } from '@/shared/lib/format';
import { SLA_TONE, slaTone } from '@/shared/lib/risk';
import type { CaseSlaResponse } from '@/shared/api/contract';

export interface SlaCountdownProps {
  sla: CaseSlaResponse;
  compact?: boolean;
  className?: string;
}

/**
 * SLA geri sayımı.
 *
 * Eşikleri (NORMAL/WARNING/URGENT/BREACHED) backend hesaplar ve `sla.status`
 * alanında gönderir; burada yeniden hesaplanmaz. Bu bileşenin tek işi kalan
 * süreyi saniye saniye canlı tutmaktır — `remainingSeconds` yanıt anındaki
 * değerdir ve ekranda durursa yanlış görünür.
 *
 * Karar verilmiş vakalarda (`stoppedAt` dolu) sayaç durur.
 */
export function SlaCountdown({ sla, compact = false, className }: SlaCountdownProps) {
  const stopped = sla.stoppedAt !== null;
  const deadline = new Date(sla.deadlineAt).getTime();

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (stopped || sla.status === 'BREACHED') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stopped, sla.status]);

  const remaining = deadline - now;
  const breached = sla.status === 'BREACHED' || sla.breachedAt !== null;
  // Aşıldıysa renk önceliğe göre (KRITIK kırmızı, YUKSEK turuncu, diğerleri sarı).
  const tone = slaTone(sla);

  const label = stopped
    ? breached
      ? 'SLA aşıldı'
      : 'SLA içinde'
    : breached
      ? 'SLA aşıldı'
      : formatCountdown(remaining);
  const chip = stopped && !breached ? SLA_TONE.NORMAL : tone;
  const data = {
    'data-sla': stopped ? (breached ? 'breached' : 'met') : breached ? 'breached' : sla.status.toLowerCase(),
    'data-sla-priority': sla.priority,
  };

  // Table form: a coloured dot and the time, no fill.
  if (compact) {
    return (
      <span
        {...data}
        className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap', chip.text, className)}
        role={!stopped && (sla.status === 'URGENT' || breached) ? 'alert' : undefined}
      >
        {breached ? (
          <TriangleAlert className="size-3.5" aria-hidden />
        ) : (
          <span className={cn('size-1.5 rounded-full', chip.bar, !stopped && sla.status === 'URGENT' && 'animate-pulse')} aria-hidden />
        )}
        <span className={cn(!stopped && !breached && 'font-mono text-[12.5px] tabular')}>{label}</span>
      </span>
    );
  }

  return (
    <span
      {...data}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md px-2 ring-1 ring-current/15 ring-inset',
        'text-xs font-medium whitespace-nowrap',
        chip.chip,
        className,
      )}
      role={!stopped && (sla.status === 'URGENT' || breached) ? 'alert' : undefined}
    >
      {breached ? (
        <TriangleAlert className="size-3.5" aria-hidden />
      ) : stopped ? null : (
        <Timer className={cn('size-3.5', sla.status === 'URGENT' && 'animate-pulse-ring')} aria-hidden />
      )}
      <span className={cn(!stopped && !breached && 'font-mono tabular')}>{label}</span>
      {!stopped && !breached && <span className="opacity-75">kaldı</span>}
    </span>
  );
}
