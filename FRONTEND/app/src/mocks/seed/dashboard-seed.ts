import type { AiMetricsResponse, DashboardResponse } from '@/shared/api/contract-pending';

/**
 * Dashboard/AI metrik mock verisi.
 *
 * DESIGN.MD kural 2 (dashboard metrikleri frontend'de hesaplanmaz) mock'a da
 * uygulanır: bu sayılar `cases-seed.ts`'ten client-side türetilmez, kendi
 * sabit tohumlarıdır — gerçek servis geldiğinde davranış kırılmasın diye.
 */

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function dashboardSnapshot(): DashboardResponse {
  return {
    summary: {
      openCases: 18,
      criticalCases: 4,
      slaBreaches: 2,
      avgDecisionMinutes: 27,
      decidedToday: 11,
      blockedToday: 3,
    },
    byStatus: [
      { status: 'YENI', count: 3 },
      { status: 'ATANDI', count: 6 },
      { status: 'INCELENIYOR', count: 5 },
      { status: 'MUSTERI_DOGRULAMA', count: 2 },
      { status: 'ONAYLANDI', count: 14 },
      { status: 'BLOKLANDI', count: 5 },
      { status: 'KAPANDI', count: 22 },
    ],
    byFraudType: [
      { fraudType: 'CALINTI_KART', count: 12 },
      { fraudType: 'HESAP_ELE_GECIRME', count: 7 },
      { fraudType: 'PARA_AKLAMA', count: 4 },
      { fraudType: 'SUPHELI_DAVRANIS', count: 9 },
      { fraudType: 'TEMIZ', count: 25 },
    ],
    byRiskLevel: [
      { riskLevel: 'DUSUK', count: 20 },
      { riskLevel: 'ORTA', count: 15 },
      { riskLevel: 'YUKSEK', count: 10 },
      { riskLevel: 'KRITIK', count: 6 },
    ],
    trend: Array.from({ length: 7 }, (_, i) => {
      const idx = 6 - i;
      return {
        date: daysAgo(idx),
        opened: 8 + ((idx * 3) % 6),
        closed: 6 + ((idx * 2) % 5),
        slaBreached: idx % 3 === 0 ? 1 : 0,
      };
    }),
    generatedAt: new Date().toISOString(),
  };
}

export function aiMetricsSnapshot(): AiMetricsResponse {
  return {
    overallAccuracy: 0.91,
    decisionAgreement: 0.86,
    falsePositiveRate: 0.07,
    totalPredictions: 1284,
    modelVersion: 'risk-1.0.0',
    byFraudType: [
      { fraudType: 'CALINTI_KART', accuracy: 0.93, sampleSize: 312 },
      { fraudType: 'HESAP_ELE_GECIRME', accuracy: 0.89, sampleSize: 201 },
      { fraudType: 'PARA_AKLAMA', accuracy: 0.85, sampleSize: 96 },
      { fraudType: 'SUPHELI_DAVRANIS', accuracy: 0.8, sampleSize: 178 },
      { fraudType: 'TEMIZ', accuracy: 0.97, sampleSize: 497 },
    ],
  };
}
