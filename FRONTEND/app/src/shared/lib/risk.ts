/**
 * Risk görselleştirme sözlüğü.
 *
 * Burada risk HESAPLANMAZ. Skor→seviye ve skor→karar eşiklerinin tek otoritesi
 * backend'dir (`RiskThresholds.cs`); frontend yalnızca gelen değeri renklendirir.
 * Eşikleri burada tekrarlamak iki doğruluk kaynağı yaratırdı.
 */

import type { DisplayRiskLevel } from '@/shared/api/contract';
import type { AssessmentStatus, RiskLevel, SlaPriority, SlaStatus } from '@/shared/api/enums';

/** Değerlendirme tamamlanmadığında backend'in yazdığı değer. */
export const UNKNOWN_RISK = 'BELIRSIZ';

export const DISPLAY_RISK_LABEL: Record<DisplayRiskLevel, string> = {
  DUSUK: 'Düşük',
  ORTA: 'Orta',
  YUKSEK: 'Yüksek',
  KRITIK: 'Kritik',
  BELIRSIZ: 'Belirsiz',
};

export interface Tone {
  /** Rozet/çip dolgusu. */
  chip: string;
  /** Vurgu metni ve ikon rengi. */
  text: string;
  /** İlerleme çubuğu dolgusu. */
  bar: string;
  /** Kart sol kenar şeridi. */
  rail: string;
  /** SVG halka rengi. */
  stroke: string;
  /**
   * Grafik dolgusu — ham hex.
   *
   * Recharts `fill`/`stroke` proplarını DOM'a doğrudan geçirir, Tailwind sınıfı
   * kabul etmez. Buraya koyuyoruz ki rozetler ile grafikler aynı risk
   * paletinden beslensin; ikinci bir renk sözlüğü doğmasın.
   * Değerler globals.css'teki semantik token'larla birebir aynıdır.
   */
  chartFill: string;
}

const TONES: Record<DisplayRiskLevel, Tone> = {
  DUSUK: {
    chip: 'bg-success-100 text-success-700',
    text: 'text-success-700',
    bar: 'bg-success-500',
    rail: 'bg-success-500',
    stroke: 'stroke-success-500',
    chartFill: '#43a047',
  },
  ORTA: {
    chip: 'bg-warning-100 text-warning-700',
    text: 'text-warning-700',
    bar: 'bg-warning-500',
    rail: 'bg-warning-500',
    stroke: 'stroke-warning-500',
    chartFill: '#f5a623',
  },
  YUKSEK: {
    chip: 'bg-danger-100 text-danger-700',
    text: 'text-danger-700',
    bar: 'bg-danger-500',
    rail: 'bg-danger-500',
    stroke: 'stroke-danger-500',
    chartFill: '#e53935',
  },
  KRITIK: {
    chip: 'bg-critical-100 text-critical-700',
    text: 'text-critical-700',
    bar: 'bg-critical-500',
    rail: 'bg-critical-500',
    stroke: 'stroke-critical-500',
    chartFill: '#b71c1c',
  },
  BELIRSIZ: {
    chip: 'bg-ink-100 text-ink-500',
    text: 'text-ink-500',
    bar: 'bg-ink-400',
    rail: 'bg-ink-400',
    stroke: 'stroke-ink-400',
    chartFill: '#8e98a4',
  },
};

/**
 * Kategorik grafik serisi (fraud tipi, işlem tipi, aksiyon dağılımı).
 *
 * Risk paletinden AYRIDIR ve öyle kalmalıdır: aynı grafikte hem kategori hem
 * risk rengi görünürse izleyici yeşili "düşük risk" sanır. Risk grafikleri
 * `riskTone().chartFill` kullanır, kategori grafikleri bunu.
 */
export const CHART_SERIES = [
  '#0a4a94',
  '#2fc4e0',
  '#6c5ce7',
  '#00a3a3',
  '#f5a623',
  '#8cc4f3',
] as const;

export function seriesColor(index: number): string {
  // Modülo sonucu her zaman aralık içindedir; `?? ` yalnızca
  // noUncheckedIndexedAccess'i susturur, negatif index'e karşı da güvencedir.
  return CHART_SERIES[Math.abs(index) % CHART_SERIES.length] ?? CHART_SERIES[0];
}

export function riskTone(level: DisplayRiskLevel | RiskLevel | null | undefined): Tone {
  return TONES[level ?? UNKNOWN_RISK];
}

/**
 * Değerlendirme bitmemişse "BELIRSIZ" gösteririz — uydurma bir skor ya da
 * sahte "düşük risk" göstermeyiz (doküman §2, §21).
 */
export function displayRisk(
  status: AssessmentStatus,
  level: RiskLevel | null | undefined,
): DisplayRiskLevel {
  if (status !== 'COMPLETED' || !level) return UNKNOWN_RISK;
  return level;
}

/** Değerlendirme henüz sonuçlanmadı mı? */
export function isAssessmentPending(status: AssessmentStatus): boolean {
  return status !== 'COMPLETED';
}

/* -------------------------------------------------------------------- SLA -- */

/**
 * SLA durumunu backend hesaplar (`CaseSlaStatusCalculator`): geçen süre
 * <%75 NORMAL, <%90 WARNING, üstü URGENT, deadline geçtiyse BREACHED.
 * Frontend eşiği yeniden hesaplamaz, yalnızca renklendirir.
 */
export const SLA_TONE: Record<SlaStatus, Tone> = {
  NORMAL: TONES.DUSUK,
  WARNING: TONES.ORTA,
  URGENT: TONES.YUKSEK,
  BREACHED: TONES.KRITIK,
};

/**
 * Case §4.4: aşılmış SLA'nın rengi vakanın önceliğine bağlıdır — KRITIK kırmızı,
 * YUKSEK turuncu, ORTA ve DUSUK görsel uyarı (sarı). Aşılmamışsa kalan süreye göre
 * NORMAL yeşil, WARNING sarı (yaklaşıyor), URGENT turuncu.
 */
export const SLA_BREACHED_TONE: Record<SlaPriority, Tone> = {
  KRITIK: TONES.KRITIK,
  YUKSEK: TONES.YUKSEK,
  ORTA: TONES.ORTA,
  DUSUK: TONES.ORTA,
};

export function slaTone(sla: { status: SlaStatus; priority: SlaPriority; breachedAt: string | null }): Tone {
  const breached = sla.status === 'BREACHED' || sla.breachedAt !== null;
  return breached ? SLA_BREACHED_TONE[sla.priority] : SLA_TONE[sla.status];
}

const SLA_PRIORITY_RANK: Record<SlaPriority, number> = { KRITIK: 3, YUKSEK: 2, ORTA: 1, DUSUK: 0 };

type SlaLike = { priority: SlaPriority; deadlineAt: string; breachedAt: string | null; status: SlaStatus };

/**
 * Panel sıralaması (case §4.4): SLA'sı aşılmış vakalar en üstte, aralarında KRITIK
 * önce; sonra kalan süresi en az olan. `Array.prototype.sort` için karşılaştırıcı.
 */
export function compareSlaUrgency(a: { sla: SlaLike }, b: { sla: SlaLike }): number {
  const breachedA = a.sla.status === 'BREACHED' || a.sla.breachedAt !== null ? 1 : 0;
  const breachedB = b.sla.status === 'BREACHED' || b.sla.breachedAt !== null ? 1 : 0;
  if (breachedA !== breachedB) return breachedB - breachedA;
  if (breachedA && a.sla.priority !== b.sla.priority) {
    return SLA_PRIORITY_RANK[b.sla.priority] - SLA_PRIORITY_RANK[a.sla.priority];
  }
  return new Date(a.sla.deadlineAt).getTime() - new Date(b.sla.deadlineAt).getTime();
}

/**
 * SLA uyum oranı (case §7): SLA'sı durmuş (karar verilmiş) vakalardan süresi
 * içinde kalanların oranı. Hiç karar yoksa null.
 */
export function slaComplianceRate(items: { sla: SlaLike & { stoppedAt: string | null } }[]): number | null {
  const decided = items.filter((item) => item.sla.stoppedAt !== null);
  if (decided.length === 0) return null;
  return decided.filter((item) => item.sla.breachedAt === null).length / decided.length;
}
