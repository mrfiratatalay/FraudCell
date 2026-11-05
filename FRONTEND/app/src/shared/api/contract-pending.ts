/**
 * ⚠️ BACKEND'İ HENÜZ YAZILMAMIŞ servislerin sözleşmesi.
 *
 * Bu dosyadaki hiçbir tipin karşılığı `BACKEND/src` altında YOKTUR. Çözümde
 * yalnızca Identity ve Transaction servisleri var; aşağıdakiler MSW mock'u
 * tarafından karşılanır:
 *
 *   - Notification (bildirim listesi + SSE)
 *   - Dashboard aggregate'leri
 *   - Sistem sağlığı (demo kontrol paneli)
 *
 * Bunlar `contract.ts` ile AYNI DOSYADA TUTULMAZ; böylece gerçek sözleşme ile
 * varsayım birbirine karışmaz. İlgili servis yazıldığında yapılacaklar:
 *   1. Tipi `contract.ts`'e gerçek C# record'una göre taşı,
 *   2. `mocks/handlers/` altındaki karşılığını sil,
 *   3. Bu dosyadan kaldır.
 *
 * Şekiller ve §53 (dashboard) baz alınarak
 * tasarlandı; gerçek servis geldiğinde DEĞİŞMESİ BEKLENİR.
 */

import type { CursorPage, PageInfo } from './contract';
import type { CaseStatus, FraudType, RiskLevel } from './enums';

export type { CursorPage, PageInfo };

/* ========================================================================== */
/*  Notification                                                              */
/* ========================================================================== */

export const NOTIFICATION_KINDS = [
  'AI_ASSESSMENT_COMPLETED',
  'CASE_ASSIGNED',
  'VERIFICATION_REQUESTED',
  'POINTS_EARNED',
  'BADGE_EARNED',
  'SLA_CRITICAL',
  'CASE_CLOSED',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Tıklanınca gidilecek uygulama içi yol. */
  link: string | null;
  createdAt: string;
  read: boolean;
}

/* ========================================================================== */
/*  Dashboard aggregate'leri                                                  */
/* ========================================================================== */

/**
 * dashboard metrikleri frontend'de HESAPLANMAZ. Servis
 * aggregate döndürür, frontend yalnızca görselleştirir. Mock da bu kurala
 * uyar — vaka listesinden türetmez, kendi aggregate'ini üretir.
 */
export interface DashboardSummary {
  openCases: number;
  criticalCases: number;
  slaBreaches: number;
  avgDecisionMinutes: number;
  decidedToday: number;
  blockedToday: number;
}

export interface CaseStatusSlice {
  status: CaseStatus;
  count: number;
}

export interface FraudTypeSlice {
  fraudType: FraudType;
  count: number;
}

export interface RiskLevelSlice {
  riskLevel: RiskLevel;
  count: number;
}

export interface CaseTrendPoint {
  /** ISO tarih (gün başlangıcı). */
  date: string;
  opened: number;
  closed: number;
  slaBreached: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  byStatus: CaseStatusSlice[];
  byFraudType: FraudTypeSlice[];
  byRiskLevel: RiskLevelSlice[];
  trend: CaseTrendPoint[];
  /** `meta.generatedAt` ile aynı; kart altında "son güncelleme" olarak gösterilir. */
  generatedAt: string;
}

/* ========================================================================== */
/*  Sistem sağlığı — demo kontrol paneli                                      */
/* ========================================================================== */

export const SERVICE_HEALTH_STATUSES = ['UP', 'DOWN', 'DEGRADED'] as const;
export type ServiceHealthStatus = (typeof SERVICE_HEALTH_STATUSES)[number];

export interface ServiceHealth {
  name: string;
  displayName: string;
  status: ServiceHealthStatus;
  detail: string;
}
