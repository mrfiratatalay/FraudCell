import type { AiMetricsResponse } from '@/shared/api/contract-pending';
import { FRAUD_TYPE_LABEL } from '@/shared/api/enums';
import { Card, SectionTitle, StatTile } from '@/shared/ui';
import { formatPercent } from '@/shared/lib/format';

export function AiAccuracyCard({ metrics }: { metrics: AiMetricsResponse }) {
  return (
    <Card>
      <SectionTitle>AI doğruluk metrikleri</SectionTitle>
      <p className="mb-3 text-xs text-ink-400">Model sürümü: {metrics.modelVersion}</p>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Genel doğruluk" value={formatPercent(metrics.overallAccuracy)} />
        <StatTile label="Karar uyumu" value={formatPercent(metrics.decisionAgreement)} />
        <StatTile
          label="Yanlış pozitif"
          value={formatPercent(metrics.falsePositiveRate)}
          tone="text-danger-500"
        />
      </div>

      <ul className="mt-4 space-y-2">
        {metrics.byFraudType.map((item) => (
          <li key={item.fraudType} className="flex items-center justify-between text-sm">
            <span className="text-ink-700">{FRAUD_TYPE_LABEL[item.fraudType]}</span>
            <span className="font-semibold tabular">
              {formatPercent(item.accuracy)}{' '}
              <span className="text-xs text-ink-400">({item.sampleSize})</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
