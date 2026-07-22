import type { CaseEffectiveRiskResponse, DisplayRiskLevel } from '@/shared/api/contract';
import { UNKNOWN_RISK } from '@/shared/lib/risk';
import type { CaseStatus } from '@/shared/api/enums';

/** `effectiveRisk.riskLevel` doluysa onu, değilse `RiskGauge`'in beklediği 'BELIRSIZ'i döner. */
export function toDisplayRisk(effectiveRisk: CaseEffectiveRiskResponse): DisplayRiskLevel {
  return effectiveRisk.riskLevel ?? UNKNOWN_RISK;
}

/** `Badge` bileşeninin `tone` prop'u için vaka durumuna göre renk eşlemesi. */
const STATUS_TONE: Record<CaseStatus, 'neutral' | 'brand' | 'warning' | 'success' | 'danger'> = {
  YENI: 'neutral',
  ATANDI: 'brand',
  INCELENIYOR: 'brand',
  MUSTERI_DOGRULAMA: 'warning',
  ONAYLANDI: 'success',
  BLOKLANDI: 'danger',
  KAPANDI: 'neutral',
};

export function caseStatusTone(status: CaseStatus) {
  return STATUS_TONE[status];
}
