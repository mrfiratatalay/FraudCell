import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * Grafik paneli çerçevesi — başlık, yardım metni, sağ aksiyon ve grafik gövdesi.
 *
 * Tüm grafikler aynı yükseklik/başlık/boşluk ritmini paylaşsın diye tek yerde.
 * `height` grafik gövdesinin sabit yüksekliğidir; Recharts ResponsiveContainer
 * yüzde yükseklik için ölçülebilir bir kap ister.
 */
export function ChartFrame({
  title,
  hint,
  action,
  height,
  children,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface-panel relative overflow-hidden p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-h3 text-ink-900">{title}</h3>
          {hint && <p className="mt-0.5 text-caption text-ink-500">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div style={height ? { height } : undefined}>{children}</div>
    </section>
  );
}
