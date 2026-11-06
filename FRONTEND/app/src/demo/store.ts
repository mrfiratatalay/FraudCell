/**
 * Browser-only demo backend: one in-memory database, saved to localStorage.
 *
 * It applies the same rules as the real services (risk bands, SLA windows,
 * case state machine, point table) so the screens behave the same in both
 * modes. Dates are generated relative to "now", so the demo never looks stale.
 */
import type { AnalystSpecialty, CaseStatus, ControlStatus, FraudType, OperationRegion, RiskLevel, Role, TransactionType } from '@/shared/api/enums';
import type { ReasonCodeResponse } from '@/shared/api/contract';

const KEY = 'fc-demo-db-v1';
const MIN = 60_000;
const HOUR = 60 * MIN;

export interface DemoUser {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string | null;
  gsm: string | null;
  specialties: AnalystSpecialty[];
  regions: OperationRegion[];
  assignmentEnabled: boolean;
  isActive: boolean;
  version: number;
  createdAt: string;
}

export interface DemoTransaction {
  id: string;
  no: string;
  customerId: string;
  amount: number;
  type: TransactionType;
  recipient: string;
  city: string;
  country: string;
  occurredAt: string;
  createdAt: string;
  score: number;
  fraudType: FraudType;
  reasons: ReasonCodeResponse[];
  controlStatus: ControlStatus;
  rating: number | null;
  version: number;
}

export interface DemoHistory {
  id: string;
  from: CaseStatus;
  to: CaseStatus;
  actorId: string | null;
  actorRole: Role | null;
  source: 'SYSTEM' | 'ANALYST' | 'SUPERVISOR' | 'CUSTOMER';
  reason: string | null;
  at: string;
}

export interface DemoCase {
  id: string;
  transactionId: string;
  status: CaseStatus;
  analystId: string | null;
  queue: 'ASSIGNED' | 'QUEUED' | 'MANUAL_QUEUE';
  manualReason: string | null;
  riskLevel: RiskLevel | null;
  fraudType: FraudType | null;
  overridden: boolean;
  slaStartedAt: string;
  decision: 'APPROVE' | 'BLOCK' | null;
  decisionNote: string | null;
  decidedAt: string | null;
  closeAt: string | null;
  verification: { id: string; requestedAt: string; answer: 'MINE' | 'NOT_MINE' | null; answeredAt: string | null } | null;
  history: DemoHistory[];
  version: number;
  createdAt: string;
}

export interface DemoLedger {
  id: string;
  analystId: string;
  caseId: string | null;
  rule: 'CASE_DECISION' | 'FAST_DECISION' | 'CONFIRMED_FRAUD' | 'CRITICAL_WITHIN_SLA' | 'SLA_BREACH' | 'FALSE_POSITIVE';
  points: number;
  description: string;
  at: string;
}

export interface DemoAudit {
  id: string;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  service: string;
  resourceType: string | null;
  resourceId: string | null;
  result: 'SUCCESS' | 'FAILURE';
  at: string;
}

export interface DemoDb {
  seededAt: string;
  users: DemoUser[];
  transactions: DemoTransaction[];
  cases: DemoCase[];
  ledger: DemoLedger[];
  badges: { analystId: string; code: string; at: string }[];
  audit: DemoAudit[];
  sessionUserId: string | null;
  seq: number;
}

/* ---------------------------------------------------------------- helpers -- */

export const iso = (ms: number) => new Date(ms).toISOString();
export const ago = (ms: number) => iso(Date.now() - ms);

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}

export function riskLevelOf(score: number): RiskLevel {
  if (score < 0.4) return 'DUSUK';
  if (score < 0.7) return 'ORTA';
  if (score <= 0.9) return 'YUKSEK';
  return 'KRITIK';
}

export function decisionOf(score: number): 'ONAY' | 'INCELEME' | 'BLOK' {
  if (score < 0.4) return 'ONAY';
  if (score <= 0.9) return 'INCELEME';
  return 'BLOK';
}

export const SLA_MS: Record<RiskLevel, number> = {
  KRITIK: 15 * MIN,
  YUKSEK: HOUR,
  ORTA: 4 * HOUR,
  DUSUK: 24 * HOUR,
};

export const REASON = {
  NEW_DEVICE: { code: 'NEW_DEVICE', label: 'İlk kez görülen cihaz', impact: 'HIGH' },
  UNUSUAL_LOCATION: { code: 'UNUSUAL_LOCATION', label: 'Alışılmadık işlem konumu', impact: 'HIGH' },
  NIGHT: { code: 'NIGHT_TRANSACTION', label: 'Gece saatinde gerçekleştirilen işlem', impact: 'MEDIUM' },
  NEW_RECIPIENT: { code: 'NEW_RECIPIENT', label: 'İlk kez görülen alıcı', impact: 'MEDIUM' },
  VELOCITY: { code: 'VELOCITY_10MIN', label: 'Kısa sürede tekrarlanan işlemler', impact: 'HIGH' },
  amount: (ratio: number): ReasonCodeResponse => ({
    code: 'AMOUNT_SPIKE',
    label: `Normal tutarın ${ratio.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} katı`,
    impact: ratio >= 5 ? 'HIGH' : 'MEDIUM',
  }),
} satisfies Record<string, ReasonCodeResponse | ((r: number) => ReasonCodeResponse)>;

/* ------------------------------------------------------------------- seed -- */

export const DEMO_CUSTOMER_GSM = '5551234567';
export const DEMO_PASSWORD = 'Demo1234!';

function user(id: string, role: Role, firstName: string, lastName: string, extra: Partial<DemoUser> = {}): DemoUser {
  return {
    id,
    role,
    firstName,
    lastName,
    email: role === 'CUSTOMER' ? null : `${firstName}.${lastName}`.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u') + '@fraudcell.demo',
    gsm: null,
    specialties: [],
    regions: [],
    assignmentEnabled: role === 'ANALYST',
    isActive: true,
    version: 1,
    createdAt: ago(30 * 24 * HOUR),
    ...extra,
  };
}

type CaseSeed = {
  customer: string;
  minutesAgo: number;
  amount: number;
  type: TransactionType;
  city: string;
  country: string;
  score: number;
  fraudType: FraudType;
  reasons: ReasonCodeResponse[];
  status?: CaseStatus;
  analyst?: string | null;
  queue?: DemoCase['queue'];
  manualReason?: string;
  answer?: 'MINE' | 'NOT_MINE';
  decision?: 'APPROVE' | 'BLOCK';
  decisionAfterMin?: number;
  rating?: number;
};

const SEEDS: CaseSeed[] = [
  // Demo customer: one waiting for her answer, one closed and not yet rated, one closed and rated.
  { customer: 'cus-1', minutesAgo: 9, amount: 18_750, type: 'TRANSFER', city: 'Londra', country: 'GB', score: 0.83, fraudType: 'HESAP_ELE_GECIRME', reasons: [REASON.NEW_DEVICE, REASON.UNUSUAL_LOCATION, REASON.amount(6.2)], status: 'MUSTERI_DOGRULAMA', analyst: 'stf-ana-2' },
  { customer: 'cus-1', minutesAgo: 26 * 60, amount: 42_000, type: 'TRANSFER', city: 'Amsterdam', country: 'NL', score: 0.94, fraudType: 'CALINTI_KART', reasons: [REASON.NEW_DEVICE, REASON.NIGHT, REASON.amount(9.8)], status: 'KAPANDI', analyst: 'stf-ana-1', answer: 'NOT_MINE', decision: 'BLOCK', decisionAfterMin: 11 },
  { customer: 'cus-1', minutesAgo: 3 * 24 * 60, amount: 6_400, type: 'ODEME', city: 'İzmir', country: 'TR', score: 0.52, fraudType: 'SUPHELI_DAVRANIS', reasons: [REASON.NEW_RECIPIENT, REASON.amount(2.6)], status: 'KAPANDI', analyst: 'stf-ana-4', answer: 'MINE', decision: 'APPROVE', decisionAfterMin: 34, rating: 5 },
  // Analyst Deniz Kaya's desk.
  { customer: 'cus-2', minutesAgo: 6, amount: 50_000, type: 'TRANSFER', city: 'New York', country: 'US', score: 0.96, fraudType: 'CALINTI_KART', reasons: [REASON.NEW_DEVICE, REASON.UNUSUAL_LOCATION, REASON.NIGHT, REASON.amount(10)], status: 'ATANDI', analyst: 'stf-ana-1' },
  { customer: 'cus-3', minutesAgo: 38, amount: 12_300, type: 'CEKIM', city: 'Antalya', country: 'TR', score: 0.78, fraudType: 'CALINTI_KART', reasons: [REASON.VELOCITY, REASON.NEW_DEVICE], status: 'INCELENIYOR', analyst: 'stf-ana-1' },
  { customer: 'cus-4', minutesAgo: 5 * 60, amount: 3_950, type: 'ODEME', city: 'Bursa', country: 'TR', score: 0.61, fraudType: 'CALINTI_KART', reasons: [REASON.NEW_RECIPIENT, REASON.NIGHT], status: 'ATANDI', analyst: 'stf-ana-1' },
  { customer: 'cus-5', minutesAgo: 7 * 60, amount: 27_500, type: 'TRANSFER', city: 'Berlin', country: 'DE', score: 0.88, fraudType: 'CALINTI_KART', reasons: [REASON.UNUSUAL_LOCATION, REASON.amount(7.4)], status: 'BLOKLANDI', analyst: 'stf-ana-1', answer: 'NOT_MINE', decision: 'BLOCK', decisionAfterMin: 9 },
  { customer: 'cus-6', minutesAgo: 30 * 60, amount: 1_250, type: 'FATURA', city: 'Ankara', country: 'TR', score: 0.47, fraudType: 'CALINTI_KART', reasons: [REASON.NEW_RECIPIENT], status: 'KAPANDI', analyst: 'stf-ana-1', decision: 'APPROVE', decisionAfterMin: 22 },
  // Other analysts.
  { customer: 'cus-7', minutesAgo: 52, amount: 95_000, type: 'TRANSFER', city: 'Dubai', country: 'AE', score: 0.91, fraudType: 'PARA_AKLAMA', reasons: [REASON.VELOCITY, REASON.UNUSUAL_LOCATION, REASON.amount(14)], status: 'INCELENIYOR', analyst: 'stf-ana-3' },
  { customer: 'cus-8', minutesAgo: 2 * 60, amount: 8_800, type: 'TRANSFER', city: 'İstanbul', country: 'TR', score: 0.72, fraudType: 'HESAP_ELE_GECIRME', reasons: [REASON.NEW_DEVICE, REASON.NEW_RECIPIENT], status: 'ATANDI', analyst: 'stf-ana-2' },
  { customer: 'cus-2', minutesAgo: 20 * 60, amount: 15_000, type: 'TRANSFER', city: 'İstanbul', country: 'TR', score: 0.69, fraudType: 'PARA_AKLAMA', reasons: [REASON.VELOCITY], status: 'KAPANDI', analyst: 'stf-ana-3', answer: 'MINE', decision: 'APPROVE', decisionAfterMin: 40 },
  { customer: 'cus-3', minutesAgo: 44 * 60, amount: 4_200, type: 'ODEME', city: 'Trabzon', country: 'TR', score: 0.58, fraudType: 'SUPHELI_DAVRANIS', reasons: [REASON.NIGHT, REASON.NEW_RECIPIENT], status: 'KAPANDI', analyst: 'stf-ana-4', answer: 'MINE', decision: 'BLOCK', decisionAfterMin: 25 },
  // Assignment queue.
  { customer: 'cus-4', minutesAgo: 14, amount: 22_000, type: 'TRANSFER', city: 'Bakü', country: 'AZ', score: 0.66, fraudType: 'SUPHELI_DAVRANIS', reasons: [REASON.UNUSUAL_LOCATION], status: 'YENI', analyst: null, queue: 'QUEUED' },
  { customer: 'cus-6', minutesAgo: 25, amount: 9_900, type: 'TRANSFER', city: 'Gaziantep', country: 'TR', score: 0.55, fraudType: 'TEMIZ', reasons: [REASON.NEW_RECIPIENT], status: 'YENI', analyst: null, queue: 'MANUAL_QUEUE', manualReason: 'Yapay zekâ türü belirleyemedi (BELIRSIZ); süpervizör ataması gerekiyor.' },
];

const CLEAN: [string, number, TransactionType, string, number][] = [
  ['cus-1', 40, 'FATURA', 'İstanbul', 640],
  ['cus-1', 5 * 60, 'ODEME', 'İstanbul', 289.9],
  ['cus-1', 2 * 24 * 60, 'TRANSFER', 'İstanbul', 2_500],
  ['cus-2', 3 * 60, 'ODEME', 'Ankara', 410],
  ['cus-5', 9 * 60, 'FATURA', 'İzmir', 980],
  ['cus-7', 15 * 60, 'CEKIM', 'Bursa', 1_500],
  ['cus-8', 28 * 60, 'ODEME', 'Konya', 175.5],
];

function seed(): DemoDb {
  const now = Date.now();
  const users: DemoUser[] = [
    user('stf-admin', 'ADMIN', 'Selin', 'Aydın'),
    user('stf-sup', 'SUPERVISOR', 'Murat', 'Demir'),
    user('stf-ana-1', 'ANALYST', 'Deniz', 'Kaya', { specialties: ['CALINTI_KART'], regions: ['MARMARA', 'EGE', 'YURT_DISI'] }),
    user('stf-ana-2', 'ANALYST', 'Ece', 'Şahin', { specialties: ['HESAP_ELE_GECIRME'], regions: ['MARMARA', 'IC_ANADOLU', 'YURT_DISI'] }),
    user('stf-ana-3', 'ANALYST', 'Can', 'Öztürk', { specialties: ['PARA_AKLAMA'], regions: ['AKDENIZ', 'YURT_DISI'] }),
    user('stf-ana-4', 'ANALYST', 'Zeynep', 'Arslan', { specialties: ['SUPHELI_DAVRANIS'], regions: ['KARADENIZ', 'IC_ANADOLU'] }),
    user('stf-ana-5', 'ANALYST', 'Burak', 'Koç', { specialties: ['CALINTI_KART'], regions: ['GUNEYDOGU_ANADOLU'], assignmentEnabled: false, isActive: false }),
    user('cus-1', 'CUSTOMER', 'Ahmet', 'Yılmaz', { gsm: DEMO_CUSTOMER_GSM }),
    user('cus-2', 'CUSTOMER', 'Elif', 'Çelik', { gsm: '5321112233' }),
    user('cus-3', 'CUSTOMER', 'Mehmet', 'Aksoy', { gsm: '5332223344' }),
    user('cus-4', 'CUSTOMER', 'Ayten', 'Kurt', { gsm: '5343334455' }),
    user('cus-5', 'CUSTOMER', 'Kerem', 'Polat', { gsm: '5354445566' }),
    user('cus-6', 'CUSTOMER', 'Gizem', 'Erdem', { gsm: '5365556677' }),
    user('cus-7', 'CUSTOMER', 'Oğuz', 'Tekin', { gsm: '5376667788' }),
    user('cus-8', 'CUSTOMER', 'Derya', 'Uçar', { gsm: '5387778899' }),
  ];

  const db: DemoDb = { seededAt: iso(now), users, transactions: [], cases: [], ledger: [], badges: [], audit: [], sessionUserId: null, seq: 0 };
  const all = [
    ...SEEDS.map((s) => ({ kind: 'case' as const, at: s.minutesAgo, s })),
    ...CLEAN.map((c) => ({ kind: 'clean' as const, at: c[1], c })),
  ].sort((a, b) => b.at - a.at);

  for (const entry of all) {
    const at = now - entry.at * MIN;
    if (entry.kind === 'clean') {
      const [customer, , type, city, amount] = entry.c;
      addTransaction(db, { customerId: customer, amount, type, city, country: 'TR', at, score: 0.08 + (amount % 7) / 100, fraudType: 'TEMIZ', reasons: [] });
      continue;
    }
    const s = entry.s;
    const tx = addTransaction(db, { customerId: s.customer, amount: s.amount, type: s.type, city: s.city, country: s.country, at, score: s.score, fraudType: s.fraudType, reasons: s.reasons });
    const c = openCase(db, tx, at, s.queue === 'MANUAL_QUEUE' ? null : riskLevelOf(s.score));
    c.queue = s.queue ?? 'ASSIGNED';
    c.manualReason = s.manualReason ?? null;
    if (s.queue === 'MANUAL_QUEUE') {
      c.fraudType = null;
      continue;
    }
    if (s.queue === 'QUEUED' || !s.analyst) continue;
    transition(c, 'ATANDI', null, null, 'SYSTEM', 'Uzmanlık ve bölgeye göre otomatik atama', at + 2_000);
    c.analystId = s.analyst;
    if (s.status === 'ATANDI') continue;
    const reviewAt = at + 3 * MIN;
    transition(c, 'INCELENIYOR', s.analyst, 'ANALYST', 'ANALYST', null, reviewAt);
    if (s.status === 'INCELENIYOR') continue;
    if (s.answer || s.status === 'MUSTERI_DOGRULAMA') {
      const askAt = reviewAt + 2 * MIN;
      transition(c, 'MUSTERI_DOGRULAMA', s.analyst, 'ANALYST', 'ANALYST', null, askAt);
      c.verification = { id: newId('ver'), requestedAt: iso(askAt), answer: null, answeredAt: null };
      if (s.status === 'MUSTERI_DOGRULAMA') continue;
      answer(db, c, s.answer!, askAt + 3 * MIN);
    }
    decide(db, c, s.decision!, s.analyst, s.decision === 'BLOCK' ? 'Müşteri işlemi tanımadı; kart bloke edildi.' : 'Müşteri işlemi doğruladı.', at + (s.decisionAfterMin ?? 20) * MIN);
    if (s.status === 'KAPANDI') {
      closeIfDue(c, Number.POSITIVE_INFINITY);
      if (s.rating) tx.rating = s.rating;
    }
  }

  for (const u of users.filter((x) => x.role !== 'CUSTOMER')) {
    db.audit.push({ id: newId('aud'), actorId: u.id, actorRole: u.role, action: 'LOGIN_SUCCEEDED', service: 'identity-service', resourceType: 'user', resourceId: u.id, result: 'SUCCESS', at: ago(Math.round(Math.random() * 8 * HOUR)) });
  }
  db.audit.push({ id: newId('aud'), actorId: null, actorRole: null, action: 'LOGIN_FAILED', service: 'identity-service', resourceType: 'user', resourceId: null, result: 'FAILURE', at: ago(95 * MIN) });
  db.audit.push({ id: newId('aud'), actorId: 'cus-3', actorRole: 'CUSTOMER', action: 'ACCESS_DENIED', service: 'transaction-service', resourceType: 'case', resourceId: null, result: 'FAILURE', at: ago(3 * HOUR) });
  return db;
}

/* ------------------------------------------------------------ operations -- */

export function addTransaction(
  db: DemoDb,
  t: { customerId: string; amount: number; type: TransactionType; city: string; country: string; at: number; score: number; fraudType: FraudType; reasons: ReasonCodeResponse[]; recipient?: string },
): DemoTransaction {
  db.seq += 1;
  const year = new Date(t.at).getFullYear();
  const tx: DemoTransaction = {
    id: `trx-${db.seq.toString().padStart(4, '0')}-${t.at.toString(36)}`,
    no: `TRX-${year}-${String(1200 + db.seq).padStart(6, '0')}`,
    customerId: t.customerId,
    amount: t.amount,
    type: t.type,
    recipient: t.recipient ?? `TR${(330001 + db.seq * 7919).toString()}00${db.seq}`,
    city: t.city,
    country: t.country,
    occurredAt: iso(t.at),
    createdAt: iso(t.at),
    score: Math.round(t.score * 100) / 100,
    fraudType: t.fraudType,
    reasons: t.reasons,
    controlStatus: decisionOf(t.score) === 'BLOK' ? 'TEMPORARILY_BLOCKED' : 'ALLOWED',
    rating: null,
    version: 1,
  };
  db.transactions.push(tx);
  return tx;
}

export function openCase(db: DemoDb, tx: DemoTransaction, at: number, level: RiskLevel | null): DemoCase {
  const c: DemoCase = {
    id: `case-${tx.id.slice(4)}`,
    transactionId: tx.id,
    status: 'YENI',
    analystId: null,
    queue: 'QUEUED',
    manualReason: null,
    riskLevel: level,
    fraudType: tx.fraudType === 'TEMIZ' ? null : tx.fraudType,
    overridden: false,
    slaStartedAt: iso(at),
    decision: null,
    decisionNote: null,
    decidedAt: null,
    closeAt: null,
    verification: null,
    history: [],
    version: 1,
    createdAt: iso(at),
  };
  db.cases.push(c);
  return c;
}

export function transition(c: DemoCase, to: CaseStatus, actorId: string | null, actorRole: Role | null, source: DemoHistory['source'], reason: string | null, at = Date.now()): void {
  c.history.push({ id: newId('his'), from: c.status, to, actorId, actorRole, source, reason, at: iso(at) });
  c.status = to;
  c.version += 1;
}

export function answer(db: DemoDb, c: DemoCase, response: 'MINE' | 'NOT_MINE', at = Date.now()): void {
  if (!c.verification) return;
  c.verification.answer = response;
  c.verification.answeredAt = iso(at);
  transition(c, 'INCELENIYOR', null, 'CUSTOMER', 'CUSTOMER', `Müşteri cevabı: ${response}`, at);
  if (response === 'NOT_MINE') {
    const tx = db.transactions.find((t) => t.id === c.transactionId);
    if (tx) tx.controlStatus = 'TEMPORARILY_BLOCKED';
  }
}

const CLOSE_AFTER_MS = 20_000;

export function decide(db: DemoDb, c: DemoCase, decision: 'APPROVE' | 'BLOCK', analystId: string, note: string | null, at = Date.now()): void {
  transition(c, decision === 'APPROVE' ? 'ONAYLANDI' : 'BLOKLANDI', analystId, 'ANALYST', 'ANALYST', note, at);
  c.decision = decision;
  c.decisionNote = note;
  c.decidedAt = iso(at);
  c.closeAt = iso(at + CLOSE_AFTER_MS);
  const tx = db.transactions.find((t) => t.id === c.transactionId);
  if (tx) tx.controlStatus = decision === 'APPROVE' ? 'APPROVED' : 'BLOCKED';
  award(db, c, analystId, at);
}

/** Point table of the case (§6.1), with the customer's answer as ground truth. */
function award(db: DemoDb, c: DemoCase, analystId: string, at: number): void {
  const add = (rule: DemoLedger['rule'], points: number, description: string) =>
    db.ledger.push({ id: newId('led'), analystId, caseId: c.id, rule, points, description, at: iso(at) });
  const seconds = (at - Date.parse(c.createdAt)) / 1000;
  const verdict = c.verification?.answer ?? null;
  const withinSla = at <= Date.parse(c.slaStartedAt) + SLA_MS[c.riskLevel ?? 'DUSUK'];
  add('CASE_DECISION', 10, 'Vaka kararı verildi.');
  if (seconds <= 15 * 60) add('FAST_DECISION', 5, 'Karar 15 dakikadan kısa sürede verildi.');
  if (c.decision === 'BLOCK' && verdict === 'NOT_MINE') {
    add('CONFIRMED_FRAUD', 15, 'Dolandırıcılık müşteri tarafından teyit edildi.');
    if (!db.badges.some((b) => b.analystId === analystId && b.code === 'FIRST_CATCH')) {
      db.badges.push({ analystId, code: 'FIRST_CATCH', at: iso(at) });
    }
  }
  if (c.decision === 'BLOCK' && verdict === 'MINE') add('FALSE_POSITIVE', -8, 'Müşterinin onayladığı meşru işlem bloklandı.');
  if (c.riskLevel === 'KRITIK' && withinSla) add('CRITICAL_WITHIN_SLA', 15, 'Kritik vaka SLA içinde çözüldü.');
  if (!withinSla) add('SLA_BREACH', -5, 'Vaka SLA süresi aşıldıktan sonra karara bağlandı.');
}

export function closeIfDue(c: DemoCase, now = Date.now()): void {
  if ((c.status === 'ONAYLANDI' || c.status === 'BLOKLANDI') && c.closeAt && (now >= Date.parse(c.closeAt) || now === Number.POSITIVE_INFINITY)) {
    const at = now === Number.POSITIVE_INFINITY ? Date.parse(c.closeAt) : now;
    transition(c, 'KAPANDI', null, null, 'SYSTEM', 'Karar sonrası bekleme süresi doldu', at);
  }
}

/* ------------------------------------------------------------ persistence -- */

let cache: DemoDb | null = null;

export function db(): DemoDb {
  if (cache) {
    cache.cases.forEach((c) => closeIfDue(c));
    return cache;
  }
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as DemoDb) : null;
  } catch {
    cache = null;
  }
  if (!cache) {
    cache = seed();
    save();
  }
  cache.cases.forEach((c) => closeIfDue(c));
  return cache;
}

export function save(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode or full storage: the demo still works for this tab.
  }
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  cache = null;
}

export const fullNameOf = (u: DemoUser | undefined) => (u ? `${u.firstName} ${u.lastName}` : null);
