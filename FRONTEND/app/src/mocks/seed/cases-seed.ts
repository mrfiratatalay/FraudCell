import type {
  CaseEffectiveRiskResponse,
  CaseResponse,
  CaseSlaResponse,
  CaseTransactionSummaryResponse,
  CaseTransitionResponse,
  NoteResponse,
} from '@/shared/api/contract';
import type {
  AssignmentStatus,
  CaseStatus,
  FraudType,
  RiskLevel,
  SlaPriority,
  SlaStatus,
  TransactionType,
  TransitionSource,
  VerificationStatus,
} from '@/shared/api/enums';
import { mockUsers } from '../db';

/**
 * Vaka mock veritabanı.
 *
 * `db.ts`'in kendi yorumu işlem/vaka/gamification tohumunu bilerek bu
 * dosyaya bırakıyor (iki takımın aynı seed dosyasında çakışmaması için).
 * Burada tutulan şekil `CaseResponse`'un ÜSTÜNE `notes`/`history` ekler —
 * gerçek sözleşmede bunlar ayrı uçlardan gelir, gövdeye gömülmez; mock'un
 * içeride ihtiyacı olması bu iki ayrı uca cevap üretebilmesi içindir.
 */
export interface MockCase {
  caseId: string;
  transaction: CaseTransactionSummaryResponse;
  status: CaseStatus;
  assignmentStatus: AssignmentStatus;
  assignedAnalystId: string | null;
  /** AI'ın orijinal tahmini — override sonrası da DEĞİŞMEZ, ayrıca saklanır. */
  aiFraudType: FraudType | null;
  aiRiskLevel: RiskLevel | null;
  riskScore: number | null;
  /** Süpervizör override'ı — doluysa `effectiveRisk` bunu yansıtır. */
  overrideFraudType: FraudType | null;
  overrideRiskLevel: RiskLevel | null;
  finalDecision: string | null;
  decisionNote: string | null;
  manualReviewReason: string | null;
  verification: {
    verificationId: string;
    requestedAt: string;
    expiresAt: string;
    status: VerificationStatus;
  } | null;
  feedbackSubmitted: boolean;
  sla: {
    priority: SlaPriority;
    startedAt: string;
    deadlineAt: string;
    breachedAt: string | null;
    stoppedAt: string | null;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
  notes: NoteResponse[];
  history: CaseTransitionResponse[];
}

const ANALYST_1 = 'usr_analyst_1';
const ANALYST_2 = 'usr_analyst_2';

/** Risk seviyesine göre SLA süresi (dakika). Gerçek eşikler backend'de. */
const SLA_MINUTES: Record<SlaPriority, number> = {
  KRITIK: 15,
  YUKSEK: 60,
  ORTA: 240,
  DUSUK: 1440,
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function startSla(priority: SlaPriority, startedMinutesAgo: number) {
  const startedAt = minutesAgo(startedMinutesAgo);
  const deadlineAt = new Date(
    new Date(startedAt).getTime() + SLA_MINUTES[priority] * 60_000,
  ).toISOString();
  return { priority, startedAt, deadlineAt, breachedAt: null, stoppedAt: null };
}

function tx(
  transactionId: string,
  transactionNo: string,
  amount: number,
  transactionType: TransactionType,
  recipientReference: string,
  city: string,
  countryCode: string,
  occurredMinutesAgo: number,
): CaseTransactionSummaryResponse {
  return {
    transactionId,
    transactionNo,
    amount,
    currency: 'TRY',
    transactionType,
    recipientReference,
    city,
    countryCode,
    occurredAt: minutesAgo(occurredMinutesAgo),
    controlStatus: 'TEMPORARILY_BLOCKED',
  };
}

let seq = 1;
function nextId(prefix: string): string {
  return `${prefix}_${String(seq++).padStart(4, '0')}`;
}

function seedCase(input: {
  transaction: CaseTransactionSummaryResponse;
  status: CaseStatus;
  assignmentStatus: AssignmentStatus;
  assignedAnalystId: string | null;
  fraudType: FraudType | null;
  riskLevel: RiskLevel;
  riskScore: number;
  slaPriority: SlaPriority;
  slaStartedMinutesAgo: number;
  manualReviewReason?: string | null;
  decided?: boolean;
}): MockCase {
  const caseId = nextId('case');
  const createdAt = minutesAgo(input.slaStartedMinutesAgo + 1);
  const sla = startSla(input.slaPriority, input.slaStartedMinutesAgo);

  const history: CaseTransitionResponse[] = [
    {
      id: nextId('trn'),
      previousStatus: 'YENI',
      newStatus: input.assignedAnalystId ? 'ATANDI' : 'YENI',
      actorId: null,
      actorRole: null,
      transitionSource: 'SYSTEM',
      reason: 'Risk değerlendirmesi tamamlandı.',
      occurredAt: createdAt,
    },
  ];

  if (input.status !== 'YENI' && input.status !== 'ATANDI' && input.assignedAnalystId) {
    history.push({
      id: nextId('trn'),
      previousStatus: 'ATANDI',
      newStatus: 'INCELENIYOR',
      actorId: input.assignedAnalystId,
      actorRole: 'ANALYST',
      transitionSource: 'ANALYST',
      reason: null,
      occurredAt: minutesAgo(Math.max(input.slaStartedMinutesAgo - 2, 0)),
    });
  }

  if (input.decided) {
    history.push({
      id: nextId('trn'),
      previousStatus: 'INCELENIYOR',
      newStatus: input.status,
      actorId: input.assignedAnalystId,
      actorRole: 'ANALYST',
      transitionSource: 'ANALYST',
      reason: null,
      occurredAt: minutesAgo(Math.max(input.slaStartedMinutesAgo - 1, 0)),
    });
  }

  return {
    caseId,
    transaction: input.transaction,
    status: input.status,
    assignmentStatus: input.assignmentStatus,
    assignedAnalystId: input.assignedAnalystId,
    aiFraudType: input.fraudType,
    aiRiskLevel: input.riskLevel,
    riskScore: input.riskScore,
    overrideFraudType: null,
    overrideRiskLevel: null,
    finalDecision: input.decided ? (input.status === 'BLOKLANDI' ? 'BLOCK' : 'APPROVE') : null,
    decisionNote: input.decided ? 'Demo tohum verisi — otomatik oluşturuldu.' : null,
    manualReviewReason: input.manualReviewReason ?? null,
    verification: null,
    feedbackSubmitted: false,
    sla: input.decided ? { ...sla, stoppedAt: minutesAgo(Math.max(input.slaStartedMinutesAgo - 1, 0)) } : sla,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    notes: [],
    history,
  };
}

export const casesStore: MockCase[] = [
  // Vakalarım'da görünecek — analiste atanmış, henüz incelemeye alınmamış.
  seedCase({
    transaction: tx('txn_0001', 'TRX-2026-000101', 4250, 'TRANSFER', 'TR** **** **12', 'İstanbul', 'TR', 6),
    status: 'ATANDI',
    assignmentStatus: 'ASSIGNED',
    assignedAnalystId: ANALYST_1,
    fraudType: 'CALINTI_KART',
    riskLevel: 'KRITIK',
    riskScore: 0.94,
    slaPriority: 'KRITIK',
    slaStartedMinutesAgo: 6,
  }),
  // İncelemede — karar ver ekranı için hazır.
  seedCase({
    transaction: tx('txn_0002', 'TRX-2026-000102', 1800, 'ODEME', 'TR** **** **44', 'Ankara', 'TR', 40),
    status: 'INCELENIYOR',
    assignmentStatus: 'ASSIGNED',
    assignedAnalystId: ANALYST_1,
    fraudType: 'SUPHELI_DAVRANIS',
    riskLevel: 'YUKSEK',
    riskScore: 0.72,
    slaPriority: 'YUKSEK',
    slaStartedMinutesAgo: 40,
  }),
  // Müşteri doğrulama bekliyor.
  seedCase({
    transaction: tx('txn_0003', 'TRX-2026-000103', 9600, 'TRANSFER', 'TR** **** **77', 'İzmir', 'TR', 20),
    status: 'MUSTERI_DOGRULAMA',
    assignmentStatus: 'ASSIGNED',
    assignedAnalystId: ANALYST_1,
    fraudType: 'HESAP_ELE_GECIRME',
    riskLevel: 'KRITIK',
    riskScore: 0.97,
    slaPriority: 'KRITIK',
    slaStartedMinutesAgo: 20,
  }),
  // SLA aşılmış — URGENT/BREACHED görselini test etmek için.
  seedCase({
    transaction: tx('txn_0004', 'TRX-2026-000104', 500, 'FATURA', 'TR** **** **09', 'Bursa', 'TR', 130),
    status: 'ATANDI',
    assignmentStatus: 'ASSIGNED',
    assignedAnalystId: ANALYST_2,
    fraudType: 'PARA_AKLAMA',
    riskLevel: 'YUKSEK',
    riskScore: 0.68,
    slaPriority: 'YUKSEK',
    slaStartedMinutesAgo: 130,
  }),
  // Kapanmış — geçmiş/notlar sekmesi için.
  seedCase({
    transaction: tx('txn_0005', 'TRX-2026-000105', 15000, 'TRANSFER', 'TR** **** **21', 'İstanbul', 'TR', 300),
    status: 'ONAYLANDI',
    assignmentStatus: 'COMPLETED',
    assignedAnalystId: ANALYST_2,
    fraudType: 'TEMIZ',
    riskLevel: 'ORTA',
    riskScore: 0.55,
    slaPriority: 'ORTA',
    slaStartedMinutesAgo: 300,
    decided: true,
  }),
  seedCase({
    transaction: tx('txn_0006', 'TRX-2026-000106', 2200, 'CEKIM', 'TR** **** **63', 'Antalya', 'TR', 480),
    status: 'BLOKLANDI',
    assignmentStatus: 'COMPLETED',
    assignedAnalystId: ANALYST_1,
    fraudType: 'CALINTI_KART',
    riskLevel: 'KRITIK',
    riskScore: 0.99,
    slaPriority: 'KRITIK',
    slaStartedMinutesAgo: 480,
    decided: true,
  }),
  // Kapasite/otomatik atama yapılamamış — kuyrukta.
  seedCase({
    transaction: tx('txn_0007', 'TRX-2026-000107', 3300, 'TRANSFER', 'TR** **** **31', 'Kayseri', 'TR', 8),
    status: 'YENI',
    assignmentStatus: 'QUEUED',
    assignedAnalystId: null,
    fraudType: 'SUPHELI_DAVRANIS',
    riskLevel: 'YUKSEK',
    riskScore: 0.65,
    slaPriority: 'YUKSEK',
    slaStartedMinutesAgo: 8,
  }),
  // AI zamanında cevap veremedi — manuel kuyrukta, süpervizör kuyruk ekranı için.
  seedCase({
    transaction: tx('txn_0008', 'TRX-2026-000108', 780, 'ODEME', 'TR** **** **02', 'Samsun', 'TR', 3),
    status: 'YENI',
    assignmentStatus: 'MANUAL_QUEUE',
    assignedAnalystId: null,
    fraudType: null,
    riskLevel: 'YUKSEK',
    riskScore: 0.7,
    slaPriority: 'YUKSEK',
    slaStartedMinutesAgo: 3,
    manualReviewReason: 'AI değerlendirmesi zaman aşımına uğradı.',
  }),
];

/* --------------------------------------------------------------- erişim -- */

export function findCase(caseId: string): MockCase | undefined {
  return casesStore.find((c) => c.caseId === caseId);
}

export function analystOf(analystId: string) {
  return mockUsers.find((u) => u.id === analystId);
}

/**
 * SLA'yı ŞİMDİKİ zamana göre yeniden hesaplar — backend'in her sorguda
 * yaptığı gibi (`CaseSlaStatusCalculator`). Frontend bunu tekrar etmez,
 * yalnızca gösterir; bu yüzden mock da kendi eşiğini burada uygular.
 */
function computeSla(sla: MockCase['sla']): CaseSlaResponse {
  const deadline = new Date(sla.deadlineAt).getTime();

  if (sla.stoppedAt) {
    const status: SlaStatus = sla.breachedAt ? 'BREACHED' : 'NORMAL';
    return {
      priority: sla.priority,
      startedAt: sla.startedAt,
      deadlineAt: sla.deadlineAt,
      breachedAt: sla.breachedAt,
      stoppedAt: sla.stoppedAt,
      status,
      remainingSeconds: 0,
    };
  }

  const now = Date.now();
  const started = new Date(sla.startedAt).getTime();
  const total = deadline - started;
  const elapsed = now - started;
  const ratio = total > 0 ? elapsed / total : 1;

  let status: SlaStatus;
  let breachedAt = sla.breachedAt;
  if (now >= deadline) {
    status = 'BREACHED';
    breachedAt ??= new Date(deadline).toISOString();
  } else if (ratio >= 0.9) {
    status = 'URGENT';
  } else if (ratio >= 0.75) {
    status = 'WARNING';
  } else {
    status = 'NORMAL';
  }

  return {
    priority: sla.priority,
    startedAt: sla.startedAt,
    deadlineAt: sla.deadlineAt,
    breachedAt,
    stoppedAt: null,
    status,
    remainingSeconds: Math.max(0, Math.round((deadline - now) / 1000)),
  };
}

export function toEffectiveRisk(c: MockCase): CaseEffectiveRiskResponse {
  return {
    riskScore: c.riskScore,
    riskLevel: c.overrideRiskLevel ?? c.aiRiskLevel,
    fraudType: c.overrideFraudType ?? c.aiFraudType,
    overridden: c.overrideFraudType !== null || c.overrideRiskLevel !== null,
  };
}

export function toCaseResponse(c: MockCase): CaseResponse {
  return {
    caseId: c.caseId,
    transaction: c.transaction,
    status: c.status,
    assignmentStatus: c.assignmentStatus,
    assignedAnalystId: c.assignedAnalystId,
    effectiveRisk: toEffectiveRisk(c),
    finalDecision: c.finalDecision,
    decisionNote: c.decisionNote,
    sla: computeSla(c.sla),
    version: c.version,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** Mutasyon sonrası ortak alan güncellemesi: versiyon artar, `updatedAt` yenilenir. */
export function touch(c: MockCase): void {
  c.version += 1;
  c.updatedAt = new Date().toISOString();
}

export function recordTransition(
  c: MockCase,
  previousStatus: CaseStatus,
  newStatus: CaseStatus,
  actorId: string | null,
  actorRole: CaseTransitionResponse['actorRole'],
  transitionSource: TransitionSource,
  reason: string | null,
): void {
  c.history.push({
    id: nextId('trn'),
    previousStatus,
    newStatus,
    actorId,
    actorRole,
    transitionSource,
    reason,
    occurredAt: new Date().toISOString(),
  });
}
