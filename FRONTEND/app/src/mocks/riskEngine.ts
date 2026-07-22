import type { CreateTransactionBody } from '@/shared/api/contract';
import type {
  FraudType,
  ReasonImpact,
  RiskLevel,
  ScreeningDecision,
} from '@/shared/api/enums';

/**
 * Mock risk motoru.
 *
 * ⚠️ Bu GERÇEK AI DEĞİLDİR ve öyle sunulmamalıdır. Case'te AI'ın
 * mock/hardcoded olması diskalifiye sebebi (DQ-003); gerçek model AI
 * Service'te eğitilecek. Buradaki kural tabanlı skor yalnızca frontend
 * geliştirilirken ekranların dolu görünmesi ve demo senaryosunun
 * (DEMO-002: gece + yurt dışı + yüksek tutar) çalışması için var.
 *
 * Eşikler backend'deki `RiskThresholds` ile aynı tutulur:
 *   < 0.40  ONAY
 *   0.40–0.90  INCELEME
 *   > 0.90  BLOK
 */

export interface ReasonCode {
  code: string;
  label: string;
  impact: ReasonImpact;
}

export interface RiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  screeningDecision: ScreeningDecision;
  fraudType: FraudType;
  reasonCodes: ReasonCode[];
}

const HIGH_RISK_COUNTRIES = new Set(['RU', 'NG', 'CN', 'UA', 'BY', 'IR']);

export function assess(input: CreateTransactionBody): RiskResult {
  const reasons: ReasonCode[] = [];
  let score = 0.08;

  const occurred = new Date(input.occurredAt);
  const hour = occurred.getHours();

  // --- Gece işlemi (DEMO-002) ---
  if (hour >= 0 && hour < 6) {
    score += 0.22;
    reasons.push({
      code: 'NIGHT_TIME',
      label: `İşlem gece saatlerinde yapıldı (${String(hour).padStart(2, '0')}:00)`,
      impact: 'MEDIUM',
    });
  }

  // --- Yurt dışı ---
  const abroad = input.location.countryCode !== 'TR';
  if (abroad) {
    const risky = HIGH_RISK_COUNTRIES.has(input.location.countryCode);
    score += risky ? 0.34 : 0.18;
    reasons.push({
      code: risky ? 'HIGH_RISK_COUNTRY' : 'FOREIGN_COUNTRY',
      label: risky
        ? `Yüksek riskli ülkeden işlem (${input.location.countryCode})`
        : `Yurt dışından işlem (${input.location.countryCode})`,
      impact: risky ? 'HIGH' : 'MEDIUM',
    });
  }

  // --- Tutar ---
  if (input.amount >= 50_000) {
    score += 0.3;
    reasons.push({
      code: 'VERY_HIGH_AMOUNT',
      label: 'Olağandışı yüksek tutar',
      impact: 'HIGH',
    });
  } else if (input.amount >= 10_000) {
    score += 0.16;
    reasons.push({ code: 'HIGH_AMOUNT', label: 'Yüksek tutarlı işlem', impact: 'MEDIUM' });
  }

  // --- İşlem tipi ---
  if (input.transactionType === 'CEKIM' && input.amount >= 10_000) {
    score += 0.1;
    reasons.push({
      code: 'LARGE_WITHDRAWAL',
      label: 'Büyük tutarlı nakit çekimi',
      impact: 'MEDIUM',
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      code: 'NORMAL_PATTERN',
      label: 'İşlem olağan davranış profiline uyuyor',
      impact: 'LOW',
    });
  }

  score = Math.min(0.99, Math.round(score * 100) / 100);

  return {
    riskScore: score,
    riskLevel: levelFor(score),
    screeningDecision: decisionFor(score),
    fraudType: fraudTypeFor(score, abroad, input.transactionType === 'CEKIM'),
    reasonCodes: reasons,
  };
}

function decisionFor(score: number): ScreeningDecision {
  if (score < 0.4) return 'ONAY';
  if (score <= 0.9) return 'INCELEME';
  return 'BLOK';
}

function levelFor(score: number): RiskLevel {
  if (score < 0.4) return 'DUSUK';
  if (score < 0.7) return 'ORTA';
  if (score <= 0.9) return 'YUKSEK';
  return 'KRITIK';
}

function fraudTypeFor(score: number, abroad: boolean, withdrawal: boolean): FraudType {
  if (score < 0.4) return 'TEMIZ';
  if (abroad && score > 0.7) return 'CALINTI_KART';
  if (withdrawal && score > 0.7) return 'PARA_AKLAMA';
  if (score > 0.8) return 'HESAP_ELE_GECIRME';
  return 'SUPHELI_DAVRANIS';
}
