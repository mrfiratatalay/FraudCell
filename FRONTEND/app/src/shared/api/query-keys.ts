/**
 * Query key kaydı.
 *
 * Merkezi tutulmasının sebebi realtime katmanıdır: SSE handler'ı bir vaka
 * güncellendiğinde `cases` ve `case-detail` cache'lerini invalidate etmek
 * zorunda ve bunu feature'ların iç anahtarlarını bilmeden yapamaz. Anahtarlar
 * feature'lara dağılsaydı, invalidate eden taraf ile query tanımlayan taraf
 * ayrı ayrı string yazar ve sessizce kaçırırdı.
 *
 * Hiyerarşi kasıtlı: `['cases']` ile invalidate etmek altındaki tüm liste
 * varyantlarını (filtre/cursor kombinasyonları) kapsar.
 */

import type { CaseStatus, RiskLevel } from './enums';

export const queryKeys = {
  /* ------------------------------------------------------------- kimlik -- */
  session: ['session'] as const,
  currentUser: ['session', 'me'] as const,
  sessions: ['session', 'devices'] as const,

  /* ------------------------------------------------------------ işlemler -- */
  transactions: {
    all: ['transactions'] as const,
    /**
     * Filtre nesnesi anahtarın parçası: farklı filtre = farklı cache girdisi.
     *
     * Parametre `Record<string, unknown>` DEĞİL `object`: arayüz (interface)
     * tipleri index signature taşımadığı için `ListTransactionsQuery` gibi
     * somut tipler Record'a atanamıyor.
     */
    list: (filters: object = {}) => ['transactions', 'list', filters] as const,
    detail: (transactionId: string) => ['transactions', 'detail', transactionId] as const,
  },

  /* --------------------------------------------------------------- vaka -- */
  cases: {
    all: ['cases'] as const,
    /** Süpervizör/admin — tüm vakalar. */
    list: (filters: { status?: CaseStatus; riskLevel?: RiskLevel } = {}) =>
      ['cases', 'list', filters] as const,
    /** Analist — kendine atanmışlar. */
    assigned: (filters: { status?: CaseStatus } = {}) => ['cases', 'assigned', filters] as const,
    assignmentQueue: (queueType: string) => ['cases', 'queue', queueType] as const,

    detail: (caseId: string) => ['cases', 'detail', caseId] as const,
    history: (caseId: string) => ['cases', 'detail', caseId, 'history'] as const,
    notes: (caseId: string) => ['cases', 'detail', caseId, 'notes'] as const,
  },

  /* ------------------------------------------------------------ müşteri -- */
  pendingVerifications: ['customer', 'verifications', 'pending'] as const,

  /* -------------------------------------------------------------- staff -- */
  staff: {
    all: ['staff'] as const,
    list: ['staff', 'list'] as const,
    detail: (staffId: string) => ['staff', 'detail', staffId] as const,
  },

  reference: {
    roles: ['reference', 'roles'] as const,
    specialties: ['reference', 'specialties'] as const,
    regions: ['reference', 'regions'] as const,
  },

  auditLogs: (filters: object = {}) => ['audit-logs', filters] as const,

  /* ----------------------------- backend'i henüz yazılmamış (MSW mock) -- */
  gamification: {
    all: ['gamification'] as const,
    me: ['gamification', 'me'] as const,
    points: ['gamification', 'me', 'points'] as const,
    badges: ['gamification', 'me', 'badges'] as const,
    leaderboard: (period: string) => ['gamification', 'leaderboard', period] as const,
  },

  notifications: ['notifications'] as const,
  dashboard: ['dashboard'] as const,
  aiMetrics: ['ai', 'metrics'] as const,
  systemHealth: ['system', 'health'] as const,
} as const;
