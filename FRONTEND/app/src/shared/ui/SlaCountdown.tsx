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

  if (stopped) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1',
          'text-xs font-semibold whitespace-nowrap',
          breached ? tone.chip : SLA_TONE.NORMAL.chip,
          className,
        )}
        data-sla={breached ? 'breached' : 'met'}
        data-sla-priority={sla.priority}
      >
        {breached ? 'SLA aşıldı' : 'SLA içinde'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1',
        'text-xs font-semibold tabular whitespace-nowrap',
        tone.chip,
        className,
      )}
      data-sla={breached ? 'breached' : sla.status.toLowerCase()}
      data-sla-priority={sla.priority}
      // Acil eşiğe girince ekran okuyucu kesintiye uğrayarak duyurur.
      role={sla.status === 'URGENT' || breached ? 'alert' : undefined}
    >
      {breached ? (
        <TriangleAlert className="size-3.5" aria-hidden />
      ) : (
        <Timer
          className={cn('size-3.5', sla.status === 'URGENT' && 'animate-pulse-ring')}
          aria-hidden
        />
      )}
      {breached ? 'SLA aşıldı' : formatCountdown(remaining)}
      {!compact && !breached && <span className="font-normal opacity-75">kaldı</span>}
    </span>
  );
}
