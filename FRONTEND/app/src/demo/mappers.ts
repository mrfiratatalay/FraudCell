/** Turns demo records into the exact response shapes of `shared/api/contract.ts`. */
import type {
  AnalystLevel,
  CaseResponse,
  CaseSlaResponse,
  CaseTransitionResponse,
  GamificationProfileResponse,
  LeaderboardItemResponse,
  StaffResponse,
  TransactionDetailResponse,
  TransactionListItemResponse,
} from '@/shared/api/contract';
import type { FraudType } from '@/shared/api/enums';
import { db, decisionOf, fullNameOf, riskLevelOf, SLA_MS, type DemoCase, type DemoTransaction, type DemoUser } from './store';

export function sla(c: DemoCase, now = Date.now()): CaseSlaResponse {
  const level = c.riskLevel ?? 'DUSUK';
  const start = Date.parse(c.slaStartedAt);
  const deadline = start + SLA_MS[level];
  const stopped = c.decidedAt ? Date.parse(c.decidedAt) : null;
  const ref = stopped ?? now;
  const breached = ref > deadline ? deadline : null;
  const ratio = (ref - start) / (deadline - start);
  const status = breached ? 'BREACHED' : ratio < 0.75 ? 'NORMAL' : ratio < 0.9 ? 'WARNING' : 'URGENT';
  return {
    priority: level,
    startedAt: c.slaStartedAt,
    deadlineAt: new Date(deadline).toISOString(),
    breachedAt: breached ? new Date(breached).toISOString() : null,
    stoppedAt: stopped ? new Date(stopped).toISOString() : null,
    status,
    remainingSeconds: Math.max(0, Math.round((deadline - ref) / 1000)),
  };
}

export function caseResponse(c: DemoCase): CaseResponse {
  const tx = db().transactions.find((t) => t.id === c.transactionId)!;
  const assignment =
    c.queue === 'MANUAL_QUEUE' && !c.analystId
      ? 'MANUAL_QUEUE'
      : !c.analystId
        ? 'QUEUED'
        : c.decidedAt
          ? 'COMPLETED'
          : c.status === 'ATANDI'
            ? 'ASSIGNED'
            : 'IN_PROGRESS';
  return {
    caseId: c.id,
    transaction: {
      transactionId: tx.id,
      transactionNo: tx.no,
      amount: tx.amount,
      currency: 'TRY',
      transactionType: tx.type,
      recipientReference: tx.recipient,
      city: tx.city,
      countryCode: tx.country,
      occurredAt: tx.occurredAt,
      controlStatus: tx.controlStatus,
    },
    status: c.status,
    assignmentStatus: assignment,
    assignedAnalystId: c.analystId,
    effectiveRisk: { riskScore: tx.score, riskLevel: c.riskLevel, fraudType: c.fraudType, overridden: c.overridden },
    finalDecision: c.decision,
    decisionNote: c.decisionNote,
    sla: sla(c),
    version: c.version,
    createdAt: c.createdAt,
    updatedAt: c.history.at(-1)?.at ?? c.createdAt,
  };
}

export function historyResponse(c: DemoCase): CaseTransitionResponse[] {
  return c.history.map((h) => ({
    id: h.id,
    previousStatus: h.from,
    newStatus: h.to,
    actorId: h.actorId,
    actorRole: h.actorRole,
    transitionSource: h.source,
    reason: h.reason,
    occurredAt: h.at,
  }));
}

const caseOf = (tx: DemoTransaction) => db().cases.find((c) => c.transactionId === tx.id) ?? null;

export function txListItem(tx: DemoTransaction): TransactionListItemResponse {
  return {
    transactionId: tx.id,
    transactionNo: tx.no,
    amount: tx.amount,
    currency: 'TRY',
    transactionType: tx.type,
    assessmentStatus: 'COMPLETED',
    displayRiskLevel: riskLevelOf(tx.score),
    screeningDecision: decisionOf(tx.score),
    controlStatus: tx.controlStatus,
    createdAt: tx.createdAt,
  };
}

export function txDetail(tx: DemoTransaction): TransactionDetailResponse {
  const c = caseOf(tx);
  return {
    transactionId: tx.id,
    transactionNo: tx.no,
    amount: tx.amount,
    currency: 'TRY',
    transactionType: tx.type,
    recipient: { reference: tx.recipient },
    location: { city: tx.city, countryCode: tx.country },
    occurredAt: tx.occurredAt,
    assessment: {
      status: 'COMPLETED',
      riskScore: tx.score,
      riskLevel: riskLevelOf(tx.score),
      screeningDecision: decisionOf(tx.score),
      fraudType: tx.fraudType,
      modelVersion: 'fraudcell-ai-1.0.0',
      reasonCodes: tx.reasons,
      assessedAt: new Date(Date.parse(tx.createdAt) + 1_200).toISOString(),
    },
    controlStatus: tx.controlStatus,
    caseId: c?.id ?? null,
    caseStatus: c?.status ?? null,
    feedbackRating: tx.rating,
    createdAt: tx.createdAt,
    version: tx.version,
  };
}

export function staffResponse(u: DemoUser): StaffResponse {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email ?? '',
    role: u.role,
    specialties: u.specialties,
    regions: u.regions,
    assignmentEnabled: u.assignmentEnabled,
    isActive: u.isActive,
    version: u.version,
    createdAt: u.createdAt,
  };
}

/* ----------------------------------------------------------- gamification -- */

const BADGE_NAME: Record<string, string> = { FIRST_CATCH: 'İlk Yakalama' };

export function levelOf(points: number): AnalystLevel {
  if (points >= 3000) return 'PLATIN';
  if (points >= 1500) return 'ALTIN';
  if (points >= 500) return 'GUMUS';
  return 'BRONZ';
}

function decidedCases(analystId: string) {
  return db().cases.filter((c) => c.decidedAt && c.history.some((h) => h.actorId === analystId && (h.to === 'ONAYLANDI' || h.to === 'BLOKLANDI')));
}

function pointsSince(analystId: string, since: number) {
  return db().ledger.filter((l) => l.analystId === analystId && Date.parse(l.at) >= since).reduce((s, l) => s + l.points, 0);
}

export function leaderboard(period: 'daily' | 'weekly'): { start: number; end: number; items: LeaderboardItemResponse[] } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'weekly') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const analysts = db().users.filter((u) => u.role === 'ANALYST' && u.isActive);
  const rows = analysts
    .map((u) => {
      const total = Math.max(0, pointsSince(u.id, 0));
      return {
        analystId: u.id,
        displayName: fullNameOf(u),
        points: Math.max(0, pointsSince(u.id, start.getTime())),
        level: levelOf(total),
        decisionCount: decidedCases(u.id).filter((c) => Date.parse(c.decidedAt!) >= start.getTime()).length,
        badgeCount: db().badges.filter((b) => b.analystId === u.id).length,
      };
    })
    .filter((r) => r.points > 0 || r.decisionCount > 0)
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ rank: i + 1, ...r }));
  const end = new Date(start);
  end.setDate(end.getDate() + (period === 'weekly' ? 7 : 1));
  return { start: start.getTime(), end: end.getTime(), items: rows };
}

export function profile(analystId: string): GamificationProfileResponse {
  const u = db().users.find((x) => x.id === analystId);
  const total = Math.max(0, pointsSince(analystId, 0));
  const decided = decidedCases(analystId);
  const perf = performance(analystId);
  const daily = leaderboard('daily').items.find((r) => r.analystId === analystId)?.rank ?? null;
  const weekly = leaderboard('weekly').items.find((r) => r.analystId === analystId)?.rank ?? null;
  return {
    analystId,
    displayName: fullNameOf(u),
    totalPoints: total,
    level: levelOf(total),
    dailyRank: daily,
    weeklyRank: weekly,
    totalDecisions: decided.length,
    averageDecisionSeconds: perf.averageDecisionSeconds,
    accuracyRate: perf.accuracyRate,
    badges: db()
      .badges.filter((b) => b.analystId === analystId)
      .map((b) => ({ code: b.code, displayName: BADGE_NAME[b.code] ?? b.code, earnedAt: b.at })),
  };
}

export function performance(analystId: string) {
  const decided = decidedCases(analystId);
  const verdict = (c: (typeof decided)[number]) => c.verification?.answer ?? null;
  const wrong = decided.filter((c) => (c.decision === 'BLOCK' && verdict(c) === 'MINE') || (c.decision === 'APPROVE' && verdict(c) === 'NOT_MINE'));
  const falsePositive = decided.filter((c) => c.decision === 'BLOCK' && verdict(c) === 'MINE').length;
  const breaches = decided.filter((c) => sla(c).breachedAt).length;
  const seconds = decided.map((c) => (Date.parse(c.decidedAt!) - Date.parse(c.createdAt)) / 1000);
  const types = new Map<FraudType, { n: number; confirmed: number; correct: number }>();
  for (const c of decided) {
    const t = (c.fraudType ?? 'TEMIZ') as FraudType;
    const row = types.get(t) ?? { n: 0, confirmed: 0, correct: 0 };
    row.n += 1;
    if (c.decision === 'BLOCK' && verdict(c) === 'NOT_MINE') row.confirmed += 1;
    if (!wrong.includes(c)) row.correct += 1;
    types.set(t, row);
  }
  return {
    analystId,
    totalDecisions: decided.length,
    correctDecisions: decided.length - wrong.length,
    falsePositiveCount: falsePositive,
    slaCompliantCount: decided.length - breaches,
    slaBreachCount: breaches,
    averageDecisionSeconds: seconds.length ? Math.round(seconds.reduce((a, b) => a + b, 0) / seconds.length) : null,
    accuracyRate: decided.length ? (decided.length - wrong.length) / decided.length : 0,
    fraudTypeBreakdown: [...types.entries()].map(([fraudType, r]) => ({
      fraudType,
      decisionCount: r.n,
      confirmedFraudCount: r.confirmed,
      accuracyRate: r.correct / r.n,
    })),
  };
}
