import type {
  AnalystScoreResponse,
  BadgeResponse,
  LeaderboardEntry,
  LeaderboardPeriod,
  PointEntry,
  PointRuleCode,
} from '@/shared/api/contract-pending';
import { mockUsers } from '../db';
import { casesStore } from './cases-seed';

/**
 * Gamification mock veritabanı.
 *
 * Backend'i henüz yazılmamış (contract-pending.ts). Ledger, karar mutasyonunun
 * yan etkisi olarak `mocks/handlers/cases.ts`'ten beslenir — bu, gerçek
 * mimaride Gamification Service'in `case.decision.made` event'ini tüketip
 * kendi projection'ını güncellemesinin mock karşılığıdır (bkz. doküman §17).
 */

interface AnalystGamificationState {
  analystId: string;
  ledger: PointEntry[];
  badges: BadgeResponse[];
  correctDecisions: number;
  totalDecisions: number;
}

const ANALYST_IDS = mockUsers.filter((u) => u.role === 'ANALYST').map((u) => u.id);

const BADGE_TEMPLATES: Omit<BadgeResponse, 'earnedAt' | 'progress' | 'progressLabel'>[] = [
  { code: 'ILK_KARAR', name: 'İlk Karar', description: 'İlk vaka kararını verdin.' },
  { code: 'HIZLI_ANALIST', name: 'Hızlı Analist', description: '10 vakayı SLA içinde çözdün.' },
  { code: 'DOLANDIRICI_AVCISI', name: 'Dolandırıcı Avcısı', description: '25 doğrulanmış dolandırıcılık tespit ettin.' },
];

function initialState(analystId: string): AnalystGamificationState {
  return {
    analystId,
    ledger: [],
    badges: BADGE_TEMPLATES.map((b) => ({ ...b, earnedAt: null, progress: 0, progressLabel: '0 / 10' })),
    correctDecisions: 0,
    totalDecisions: 0,
  };
}

const state = new Map<string, AnalystGamificationState>(
  ANALYST_IDS.map((id) => [id, initialState(id)]),
);

function ensure(analystId: string): AnalystGamificationState {
  let existing = state.get(analystId);
  if (!existing) {
    existing = initialState(analystId);
    state.set(analystId, existing);
  }
  return existing;
}

let seq = 1;
function nextId(): string {
  return `pt_${String(seq++).padStart(4, '0')}`;
}

function evaluateBadges(s: AnalystGamificationState): void {
  const decisionCount = s.totalDecisions;
  const fraudConfirmed = s.ledger.filter((e) => e.ruleCode === 'CONFIRMED_FRAUD').length;
  const fastDecisions = s.ledger.filter((e) => e.ruleCode === 'FAST_DECISION').length;

  const progressFor = (code: string): { progress: number; label: string; earned: boolean } => {
    if (code === 'ILK_KARAR') {
      return { progress: decisionCount >= 1 ? 1 : 0, label: `${Math.min(decisionCount, 1)} / 1`, earned: decisionCount >= 1 };
    }
    if (code === 'HIZLI_ANALIST') {
      return {
        progress: Math.min(fastDecisions / 10, 1),
        label: `${Math.min(fastDecisions, 10)} / 10`,
        earned: fastDecisions >= 10,
      };
    }
    return {
      progress: Math.min(fraudConfirmed / 25, 1),
      label: `${Math.min(fraudConfirmed, 25)} / 25`,
      earned: fraudConfirmed >= 25,
    };
  };

  s.badges = s.badges.map((badge) => {
    const { progress, label, earned } = progressFor(badge.code);
    return {
      ...badge,
      progress,
      progressLabel: label,
      earnedAt: earned ? (badge.earnedAt ?? new Date().toISOString()) : badge.earnedAt,
    };
  });
}

/** Karar mutasyonunun yan etkisi: kural bazlı puanları ledger'a ekler. */
export function awardDecisionPoints(
  analystId: string,
  caseId: string,
  transactionNo: string,
  entries: { ruleCode: PointRuleCode; points: number }[],
  correct: boolean,
): { newlyEarnedBadges: BadgeResponse[] } {
  const s = ensure(analystId);
  const now = new Date().toISOString();

  for (const entry of entries) {
    s.ledger.push({
      id: nextId(),
      caseId,
      transactionNo,
      ruleCode: entry.ruleCode,
      points: entry.points,
      occurredAt: now,
    });
  }

  s.totalDecisions += 1;
  if (correct) s.correctDecisions += 1;

  const before = s.badges.filter((b) => b.earnedAt !== null).map((b) => b.code);
  evaluateBadges(s);
  const after = s.badges.filter((b) => b.earnedAt !== null);
  const newlyEarnedBadges = after.filter((b) => !before.includes(b.code));

  return { newlyEarnedBadges };
}

function activeCasesOf(analystId: string): number {
  return casesStore.filter(
    (c) =>
      c.assignedAnalystId === analystId &&
      (c.status === 'ATANDI' || c.status === 'INCELENIYOR' || c.status === 'MUSTERI_DOGRULAMA'),
  ).length;
}

function pointsSince(ledger: PointEntry[], msAgo: number): number {
  const threshold = Date.now() - msAgo;
  return ledger
    .filter((e) => new Date(e.occurredAt).getTime() >= threshold)
    .reduce((sum, e) => sum + e.points, 0);
}

export function scoreFor(analystId: string): AnalystScoreResponse {
  const s = ensure(analystId);
  const totalPoints = s.ledger.reduce((sum, e) => sum + e.points, 0);
  const activeCases = activeCasesOf(analystId);
  const ranked = rankedTotals('daily');
  const rankedWeekly = rankedTotals('weekly');

  return {
    analystId,
    totalPoints,
    dailyPoints: pointsSince(s.ledger, 24 * 3600_000),
    weeklyPoints: pointsSince(s.ledger, 7 * 24 * 3600_000),
    resolvedCases: s.totalDecisions,
    activeCases,
    capacity: Math.max(0, 1 - activeCases / 10),
    accuracy: s.totalDecisions > 0 ? s.correctDecisions / s.totalDecisions : 1,
    dailyRank: (ranked.find((r) => r.analystId === analystId)?.rank ?? ranked.length + 1),
    weeklyRank: (rankedWeekly.find((r) => r.analystId === analystId)?.rank ?? rankedWeekly.length + 1),
  };
}

export function ledgerFor(analystId: string): PointEntry[] {
  return [...ensure(analystId).ledger].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export function badgesFor(analystId: string): BadgeResponse[] {
  return ensure(analystId).badges;
}

function rankedTotals(period: LeaderboardPeriod): { analystId: string; points: number; rank: number }[] {
  const windowMs = period === 'daily' ? 24 * 3600_000 : 7 * 24 * 3600_000;
  const totals = ANALYST_IDS.map((id) => ({
    analystId: id,
    points: pointsSince(ensure(id).ledger, windowMs),
  })).sort((a, b) => b.points - a.points);

  return totals.map((t, index) => ({ ...t, rank: index + 1 }));
}

export function leaderboard(period: LeaderboardPeriod, currentUserId: string): LeaderboardEntry[] {
  const ranked = rankedTotals(period);
  return ranked.map((entry) => {
    const s = ensure(entry.analystId);
    const analyst = mockUsers.find((u) => u.id === entry.analystId);
    return {
      rank: entry.rank,
      analystId: entry.analystId,
      analystName: [analyst?.firstName, analyst?.lastName].filter(Boolean).join(' '),
      points: entry.points,
      resolvedCases: s.totalDecisions,
      accuracy: s.totalDecisions > 0 ? s.correctDecisions / s.totalDecisions : 1,
      isCurrentUser: entry.analystId === currentUserId,
    };
  });
}
