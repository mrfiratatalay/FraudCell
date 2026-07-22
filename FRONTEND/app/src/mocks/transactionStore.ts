import type { CreateTransactionBody, TransactionDetailResponse } from '@/shared/api/contract';
// Bildirim servisinin backend'i henüz yazılmadı; tipi ayrı dosyada.
import type { AppNotification } from '@/shared/api/contract-pending';
import type { AssessmentStatus, ControlStatus } from '@/shared/api/enums';
import { assess, type ReasonCode } from './riskEngine';

/**
 * Bellekteki işlem/vaka deposu.
 *
 * Gerçek backend'de bunlar Transaction Service'in veritabanında; mock burada
 * yalnızca frontend geliştirilirken ekranların dolu görünmesi için tutuyor.
 */

export interface MockTransaction {
  id: string;
  transactionNo: string;
  customerId: string;
  amount: number;
  currency: string;
  transactionType: CreateTransactionBody['transactionType'];
  recipientReference: string;
  city: string;
  countryCode: string;
  occurredAt: string;
  createdAt: string;

  assessmentStatus: AssessmentStatus;
  riskScore: number | null;
  riskLevel: TransactionDetailResponse['assessment']['riskLevel'];
  screeningDecision: TransactionDetailResponse['assessment']['screeningDecision'];
  fraudType: TransactionDetailResponse['assessment']['fraudType'];
  reasonCodes: ReasonCode[];
  modelVersion: string | null;
  assessedAt: string | null;

  controlStatus: ControlStatus;
  caseId: string | null;
  version: number;
}

export interface MockVerification {
  verificationId: string;
  caseId: string;
  transactionId: string;
  status: 'PENDING' | 'ANSWERED';
  requestedAt: string;
  expiresAt: string;
}

/**
 * Depo `sessionStorage`'a yazılır.
 *
 * Modül değişkeninde tutulsaydı her tam sayfa yenilemesi (F5, adres çubuğuna
 * yazıp Enter) veriyi sıfırlardı: kullanıcı işlem oluşturup sayfayı yeniler,
 * işlemi kaybolur. Jüri demosunda bu kabul edilemez.
 *
 * Sekme kapanınca temizlenir — kalıcı bir sahte veritabanı istemiyoruz.
 */
const STORE_KEY = 'fraudcell.mock.store';

interface Snapshot {
  transactions: MockTransaction[];
  verifications: MockVerification[];
  notifications: AppNotification[];
  sequence: number;
}

function load(): Snapshot {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Snapshot;
  } catch {
    // Bozuk ya da erişilemeyen storage: boş depoyla devam.
  }
  return { transactions: [], verifications: [], notifications: [], sequence: 1 };
}

const snapshot = load();

export const transactions: MockTransaction[] = snapshot.transactions;
export const verifications: MockVerification[] = snapshot.verifications;
export const notifications: AppNotification[] = snapshot.notifications;

let sequence = snapshot.sequence;

/**
 * Depoyu diske yazar.
 *
 * Diziler yerinde değiştirildiği (push/unshift) için her mutasyondan sonra
 * ÇAĞRILMALIDIR; otomatik izleme yok.
 */
export function persist(): void {
  try {
    sessionStorage.setItem(
      STORE_KEY,
      JSON.stringify({ transactions, verifications, notifications, sequence }),
    );
  } catch {
    // Yut: mock verisinin kalıcılığı kritik değil.
  }
}

export function nextTransactionNo(): string {
  return `TRX-2026-${String(sequence++).padStart(6, '0')}`;
}

export function pushNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
  notifications.unshift({
    ...n,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
  });
  persist();
}

/**
 * Değerlendirmeyi işleme uygular.
 *
 * Gerçek sistemde bu asenkron bir event tüketicisidir; mock'ta işlem
 * yaratıldıktan KISA SÜRE SONRA çalışır, böylece arayüzdeki "değerlendiriliyor"
 * durumu gerçekten görülebilir (UX-CUS-003).
 */
export function applyAssessment(tx: MockTransaction, input: CreateTransactionBody): void {
  const result = assess(input);

  tx.assessmentStatus = 'COMPLETED';
  tx.riskScore = result.riskScore;
  tx.riskLevel = result.riskLevel;
  tx.screeningDecision = result.screeningDecision;
  tx.fraudType = result.fraudType;
  tx.reasonCodes = result.reasonCodes;
  tx.modelVersion = 'mock-rules-0.1';
  tx.assessedAt = new Date().toISOString();

  if (result.screeningDecision === 'BLOK') {
    tx.controlStatus = 'TEMPORARILY_BLOCKED';
  }

  // INCELEME ve BLOK bir risk vakası doğurur; ONAY doğurmaz.
  if (result.screeningDecision !== 'ONAY') {
    tx.caseId = `case_${tx.id}`;

    // Yüksek riskte müşteriden doğrulama istenir (UX-CUS-004/005).
    if (result.riskScore >= 0.7) {
      verifications.push({
        verificationId: crypto.randomUUID(),
        caseId: tx.caseId,
        transactionId: tx.id,
        status: 'PENDING',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      });

      pushNotification({
        kind: 'VERIFICATION_REQUESTED',
        title: 'İşlem doğrulaman bekleniyor',
        body: `${tx.transactionNo} numaralı işlem için onayın isteniyor.`,
        link: '/customer/verifications',
      });
    }
  }

  pushNotification({
    kind: 'AI_ASSESSMENT_COMPLETED',
    title: 'İşlem değerlendirildi',
    body: `${tx.transactionNo} — risk %${Math.round(result.riskScore * 100)}, ${result.screeningDecision}`,
    link: `/customer/transactions/${tx.id}`,
  });

  tx.version += 1;
  persist();
}

/** Sözleşmedeki detay şekline dönüştürür. */
export function toDetail(tx: MockTransaction): TransactionDetailResponse {
  return {
    transactionId: tx.id,
    transactionNo: tx.transactionNo,
    amount: tx.amount,
    currency: tx.currency,
    transactionType: tx.transactionType,
    recipient: { reference: tx.recipientReference },
    location: { city: tx.city, countryCode: tx.countryCode },
    occurredAt: tx.occurredAt,
    assessment: {
      status: tx.assessmentStatus,
      riskScore: tx.riskScore,
      riskLevel: tx.riskLevel,
      screeningDecision: tx.screeningDecision,
      fraudType: tx.fraudType,
      modelVersion: tx.modelVersion,
      reasonCodes: tx.reasonCodes,
      assessedAt: tx.assessedAt,
    },
    controlStatus: tx.controlStatus,
    caseId: tx.caseId,
    createdAt: tx.createdAt,
    version: tx.version,
  };
}

/**
 * Demo için başlangıç verisi.
 *
 * Jüri sunumunda müşteri hesabı boş açılmasın diye üç işlem tohumlanıyor:
 * biri temiz, biri incelemede, biri doğrulama bekleyen kritik.
 */
export function seedTransactions(customerId: string): void {
  if (transactions.length > 0) return;

  const now = Date.now();
  const presets: { input: CreateTransactionBody; agoMinutes: number }[] = [
    {
      agoMinutes: 45,
      input: {
        amount: 250,
        currency: 'TRY',
        transactionType: 'FATURA',
        recipient: { reference: 'Elektrik faturası' },
        device: { fingerprint: 'seed' },
        location: { city: 'İstanbul', countryCode: 'TR' },
        occurredAt: new Date(now - 45 * 60_000).toISOString(),
      },
    },
    {
      agoMinutes: 180,
      input: {
        amount: 14_500,
        currency: 'TRY',
        transactionType: 'TRANSFER',
        recipient: { reference: 'TR44 **** 8821' },
        device: { fingerprint: 'seed' },
        location: { city: 'Ankara', countryCode: 'TR' },
        occurredAt: new Date(now - 180 * 60_000).toISOString(),
      },
    },
    {
      agoMinutes: 20,
      input: {
        amount: 62_000,
        currency: 'TRY',
        transactionType: 'CEKIM',
        recipient: { reference: 'ATM-9931' },
        device: { fingerprint: 'seed-unknown' },
        location: { city: 'Moskova', countryCode: 'RU' },
        // Gece + yurt dışı + yüksek tutar: DEMO-002 senaryosu.
        occurredAt: new Date(new Date(now - 20 * 60_000).setHours(3, 12, 0, 0)).toISOString(),
      },
    },
  ];

  for (const { input, agoMinutes } of presets) {
    const tx = createFrom(input, customerId, new Date(now - agoMinutes * 60_000).toISOString());
    applyAssessment(tx, input);
    transactions.push(tx);
  }

  // Tohum bildirimleri okunmuş sayılır; sayaç ilk GERÇEK olayda çıksın.
  for (const n of notifications) n.read = true;
  persist();
}

export function createFrom(
  input: CreateTransactionBody,
  customerId: string,
  createdAt = new Date().toISOString(),
): MockTransaction {
  return {
    id: `trx_${crypto.randomUUID().slice(0, 12)}`,
    transactionNo: nextTransactionNo(),
    customerId,
    amount: input.amount,
    currency: input.currency,
    transactionType: input.transactionType,
    recipientReference: input.recipient.reference,
    city: input.location.city,
    countryCode: input.location.countryCode,
    occurredAt: input.occurredAt,
    createdAt,
    assessmentStatus: 'PENDING',
    riskScore: null,
    riskLevel: null,
    screeningDecision: null,
    fraudType: null,
    reasonCodes: [],
    modelVersion: null,
    assessedAt: null,
    controlStatus: 'ALLOWED',
    caseId: null,
    version: 1,
  };
}
