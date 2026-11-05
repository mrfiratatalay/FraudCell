/**
 * Backend HTTP sözleşmesinin frontend'deki tek temsili.
 *
 * Bu dosya BACKEND'deki `*Response` / `*Request` record'larından birebir
 * türetilmiştir. Alan adları C# tarafında `JsonNamingPolicy.CamelCase` ile
 * serialize edildiği için burada camelCase yazılır.
 *
 * Sözleşme değişirse tek değiştirilecek yer burasıdır. Ekranlar ve feature
 * hook'ları backend alan adlarını doğrudan kullanmaz; `features/*` katmanı
 * gerekiyorsa kendi görünüm modelini bu tiplerden türetir.
 *
 * Kaynak dosyalar:
 *   Identity    → Features/{Auth,Staff,Audit,Reference}/**
 *   Transaction → Features/{Transactions,Cases}/**
 *   Ortak zarf  → BuildingBlocks/Api/ApiResponse.cs
 */

import type {
  AnalystSpecialty,
  AssessmentStatus,
  AssignmentSource,
  AssignmentStatus,
  AuditResult,
  CaseStatus,
  ControlStatus,
  FraudType,
  OperationRegion,
  OtpPurpose,
  ReasonImpact,
  Role,
  RiskLevel,
  ScreeningDecision,
  SlaPriority,
  SlaStatus,
  TransactionType,
  TransitionSource,
  VerificationResponse,
  VerificationStatus,
} from './enums';

/* ========================================================================== */
/*  Ortak zarf — BuildingBlocks/Api/ApiResponse.cs                            */
/* ========================================================================== */

export interface ApiError {
  /** `ErrorCodes` kataloğundaki sabit kod. Ekranlar buna göre davranır. */
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

/**
 * `meta.pagination` yalnızca liste yanıtlarında dolar; `generatedAt` yalnızca
 * rapor/dashboard yanıtlarında.
 */
export interface ApiMeta {
  traceId: string;
  pagination?: PageInfo | null;
  generatedAt?: string | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: ApiError;
  meta: ApiMeta;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

/**
 * Cursor/keyset pagination. DİKKAT: sayfa numarası, toplam kayıt ve toplam
 * sayfa YOKTUR — arayüzde "3 / 12. sayfa" gösterilemez, "Daha fazla yükle"
 * kalıbı kullanılır.
 */
export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

/** Liste endpoint'lerinin `data` alanının standart şekli. */
export interface CursorPage<T> {
  items: T[];
  page: PageInfo;
}

/** Tüm liste endpoint'lerinin ortak sorgu parametreleri. */
export interface CursorQuery {
  cursor?: string | null;
  /** Backend 1–100 aralığına kırpar; varsayılan 20. */
  limit?: number;
}

/* ========================================================================== */
/*  Identity — kimlik doğrulama                                               */
/* ========================================================================== */

/** `POST /api/v1/auth/customer/otp/challenges` */
export interface RequestOtpChallengeBody {
  gsmNumber: string;
  purpose: OtpPurpose;
}

export interface RequestOtpChallengeResponse {
  challengeId: string;
  expiresAt: string;
  /** Numaranın maskeli hâli — ekranda bunu gösteriyoruz, ham numarayı değil. */
  maskedGsmNumber: string;
  /** Yalnızca demo profilinde dolu; jüri OTP'yi SMS beklemeden görebilsin diye. */
  demoHint: string | null;
}

/** Yeni numarada müşteri bilgisi ayrı bir register çağrısıyla değil, doğrulama isteğiyle birlikte gider. */
export interface VerifyOtpCustomerInfo {
  firstName: string;
  lastName: string;
  email: string | null;
}

/** `POST /api/v1/auth/customer/otp/verifications` */
export interface VerifyOtpChallengeBody {
  challengeId: string;
  code: string;
  /** Login challenge'ında null; register challenge'ında zorunludur. */
  customer: VerifyOtpCustomerInfo | null;
}

export interface VerifiedUserResponse {
  id: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  gsmNumberMasked: string;
}

export interface VerifyOtpChallengeResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: VerifiedUserResponse;
}

/** `POST /api/v1/auth/staff/login` */
export interface StaffLoginBody {
  email: string;
  password: string;
}

export interface StaffLoginUserResponse {
  id: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  specialties: AnalystSpecialty[];
  regions: OperationRegion[];
}

export interface StaffLoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: StaffLoginUserResponse;
}

/**
 * `POST /api/v1/auth/refresh`
 *
 * Refresh token gövdede taşınmaz; Secure/HttpOnly cookie'dedir. Bu yüzden
 * istek gövdesizdir ve `credentials: 'include'` ile gönderilmelidir.
 */
export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
}

/** `GET /api/v1/auth/me` */
export interface CurrentUserResponse {
  id: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gsmNumber: string | null;
  specialties: AnalystSpecialty[];
  regions: OperationRegion[];
}

/** `GET /api/v1/auth/sessions` — aktif cihaz oturumları. */
export interface SessionResponse {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  createdIp: string | null;
  userAgent: string | null;
  /** Bu oturum şu an kullanılan oturumsa true — "bu cihaz" etiketi için. */
  isCurrent: boolean;
}

/* ========================================================================== */
/*  Identity — personel yönetimi (ADMIN)                                      */
/* ========================================================================== */

/** `GET /api/v1/staff`, `GET /api/v1/staff/{staffId}` */
export interface StaffResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  specialties: AnalystSpecialty[];
  regions: OperationRegion[];
  /** false ise otomatik atama motoru bu analiste vaka vermez. */
  assignmentEnabled: boolean;
  isActive: boolean;
  /** `If-Match` header'ında gönderilecek versiyon. */
  version: number;
  createdAt: string;
}

/** `POST /api/v1/staff` */
export interface CreateStaffBody {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  specialties: AnalystSpecialty[];
  regions: OperationRegion[];
  assignmentEnabled?: boolean;
}

/** `PATCH /api/v1/staff/{staffId}` — yalnızca gönderilen alanlar değişir. */
export interface UpdateStaffBody {
  firstName?: string | null;
  lastName?: string | null;
  assignmentEnabled?: boolean | null;
  isActive?: boolean | null;
}

/** `PUT /api/v1/staff/{staffId}/role` */
export interface UpdateStaffRoleBody {
  role: Role;
}

/** `PUT /api/v1/staff/{staffId}/specialties` */
export interface UpdateStaffSpecialtiesBody {
  specialties: AnalystSpecialty[];
}

/** `PUT /api/v1/staff/{staffId}/regions` */
export interface UpdateStaffRegionsBody {
  regions: OperationRegion[];
}

/* ========================================================================== */
/*  Identity — referans veriler ve denetim                                    */
/* ========================================================================== */

/** `GET /api/v1/reference/{roles|specialties|regions}` */
export interface ReferenceItemResponse {
  code: string;
  displayName: string;
}

/** `GET /api/v1/audit-logs`, `GET /api/v1/audit-logs/{auditId}` */
export interface AuditLogResponse {
  id: string;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  sourceService: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  result: AuditResult;
  occurredAt: string;
  /** Serialize edilmiş JSON string — parse etmeden gösterme. */
  detailsJson: string | null;
}

/* ========================================================================== */
/*  Transaction — işlemler                                                    */
/* ========================================================================== */

/**
 * Değerlendirme tamamlanmadığında backend `displayRiskLevel` alanına
 * `"BELIRSIZ"` yazar; uydurma bir skor göstermez (doküman §2, §21).
 */
export type DisplayRiskLevel = RiskLevel | 'BELIRSIZ';

/** `GET /api/v1/transactions` — liste satırı (detaydan daha dar). */
export interface TransactionListItemResponse {
  transactionId: string;
  transactionNo: string;
  amount: number;
  currency: string;
  transactionType: TransactionType;
  assessmentStatus: AssessmentStatus;
  displayRiskLevel: DisplayRiskLevel;
  screeningDecision: ScreeningDecision;
  controlStatus: ControlStatus;
  createdAt: string;
}

export interface ListTransactionsQuery extends CursorQuery {
  /** Yalnızca SUPERVISOR/ADMIN kullanabilir; müşteri kendi işlemlerini görür. */
  customerId?: string;
  assessmentStatus?: AssessmentStatus;
  riskLevel?: RiskLevel;
}

export interface ReasonCodeResponse {
  code: string;
  label: string;
  impact: ReasonImpact;
}

/**
 * AI değerlendirme çıktısı. `status` COMPLETED değilken skor/seviye/karar
 * alanlarının hepsi null gelir.
 */
export interface AssessmentResponse {
  status: AssessmentStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  screeningDecision: ScreeningDecision | null;
  fraudType: FraudType | null;
  modelVersion: string | null;
  /** Model açıklaması değildir; rule/feature katmanından üretilir (doküman §12). */
  reasonCodes: ReasonCodeResponse[];
  assessedAt: string | null;
}

export interface RecipientResponse {
  reference: string;
}

export interface LocationResponse {
  city: string;
  countryCode: string;
}

/** `GET /api/v1/transactions/{transactionId}` */
export interface TransactionDetailResponse {
  transactionId: string;
  transactionNo: string;
  amount: number;
  currency: string;
  transactionType: TransactionType;
  recipient: RecipientResponse;
  location: LocationResponse;
  occurredAt: string;
  assessment: AssessmentResponse;
  controlStatus: ControlStatus;
  /** Bu işlemden bir risk vakası doğduysa dolu. */
  caseId: string | null;
  /** Vakanın durumu; vaka yoksa null. */
  caseStatus: CaseStatus | null;
  /** Müşterinin bu vakaya verdiği 1–5 yıldız; henüz vermediyse null. */
  feedbackRating: number | null;
  createdAt: string;
  version: number;
}

/**
 * `POST /api/v1/transactions`
 *
 * `Idempotency-Key` header'ı ZORUNLUDUR (max 100 karakter). Aynı anahtar farklı
 * gövdeyle tekrar kullanılırsa 409 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`
 * döner; aynı gövdeyle tekrarlanırsa ilk yanıt `Idempotency-Replayed: true`
 * header'ıyla yeniden oynatılır.
 */
export interface CreateTransactionBody {
  amount: number;
  currency: string;
  transactionType: TransactionType;
  recipient: { reference: string };
  device: { fingerprint: string };
  location: { city: string; countryCode: string };
  occurredAt: string;
}

/**
 * 201 Created. Değerlendirme asenkron olduğu için `assessmentStatus` PENDING
 * gelir ve risk alanları null olur — ekran bunu "değerlendiriliyor" olarak
 * göstermeli, sıfır risk olarak değil.
 */
export interface CreateTransactionResponse {
  transactionId: string;
  transactionNo: string;
  amount: number;
  currency: string;
  transactionType: TransactionType;
  assessmentStatus: AssessmentStatus;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  displayRiskLevel: DisplayRiskLevel;
  screeningDecision: ScreeningDecision;
  controlStatus: ControlStatus;
  temporaryBlocked: boolean;
  createdAt: string;
}

/* ========================================================================== */
/*  Transaction — risk vakaları                                               */
/* ========================================================================== */

/**
 * SLA bloğu. `remainingSeconds` ve `status` backend'de hesaplanır; frontend
 * geri sayımı yalnızca canlı tutar, eşikleri kendi belirlemez.
 */
export interface CaseSlaResponse {
  priority: SlaPriority;
  startedAt: string;
  deadlineAt: string;
  breachedAt: string | null;
  /** Karar verildiğinde sayaç durur. */
  stoppedAt: string | null;
  status: SlaStatus;
  remainingSeconds: number;
}

/** Vakanın içindeki işlem özeti — tam `TransactionDetailResponse` değildir. */
export interface CaseTransactionSummaryResponse {
  transactionId: string;
  transactionNo: string;
  amount: number;
  currency: string;
  transactionType: TransactionType;
  recipientReference: string;
  city: string;
  countryCode: string;
  occurredAt: string;
  controlStatus: ControlStatus;
}

/**
 * Yürürlükteki risk. Süpervizör override ettiyse `overridden` true olur ve
 * alanlar AI'ın değil süpervizörün değerlerini taşır.
 */
export interface CaseEffectiveRiskResponse {
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  fraudType: FraudType | null;
  overridden: boolean;
}

/**
 * `GET /api/v1/cases/{caseId}`
 *
 * DİKKAT: notlar, geçmiş ve doğrulama istekleri bu gövdenin İÇİNDE GELMEZ.
 * Ayrı endpoint'lerden çekilir (`/notes`, `/history`).
 */
export interface CaseResponse {
  caseId: string;
  transaction: CaseTransactionSummaryResponse;
  status: CaseStatus;
  assignmentStatus: AssignmentStatus;
  assignedAnalystId: string | null;
  effectiveRisk: CaseEffectiveRiskResponse;
  finalDecision: string | null;
  decisionNote: string | null;
  sla: CaseSlaResponse;
  /** `If-Match` header'ında gönderilecek versiyon. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/v1/cases` — SUPERVISOR/ADMIN. */
export interface ListCasesQuery extends CursorQuery {
  status?: CaseStatus;
  riskLevel?: RiskLevel;
}

/** `GET /api/v1/cases/assigned` — ANALYST. Filtre verilmezse KAPANDI hariç tutulur. */
export interface ListAssignedCasesQuery {
  status?: CaseStatus;
  limit?: number;
}

/** `GET /api/v1/cases/assignment-queue` — SUPERVISOR/ADMIN. */
export interface AssignmentQueueItemResponse {
  caseId: string;
  transactionNo: string;
  assignmentStatus: AssignmentStatus;
  manualReviewReason: string | null;
  displayRiskLevel: DisplayRiskLevel;
  slaPriority: SlaPriority;
  slaDeadlineAt: string;
  createdAt: string;
  version: number;
}

export interface AssignmentQueueQuery {
  /** Yalnızca QUEUED veya MANUAL_QUEUE kabul edilir. */
  /** Varsayılan ALL: BELIRSIZ (manuel) ve kapasite bekleyen vakalar birlikte. */
  queueType?: 'ALL' | 'QUEUED' | 'MANUAL_QUEUE';
  limit?: number;
}

/** `GET /api/v1/cases/{caseId}/history` */
export interface CaseTransitionResponse {
  id: string;
  previousStatus: CaseStatus;
  newStatus: CaseStatus;
  actorId: string | null;
  actorRole: Role | null;
  transitionSource: TransitionSource;
  reason: string | null;
  occurredAt: string;
}

/** `GET`/`POST /api/v1/cases/{caseId}/notes` */
export interface NoteResponse {
  noteId: string;
  caseId: string;
  authorId: string;
  /** Düz metin. HTML kabul edilmez (doküman §20 — XSS). */
  text: string;
  createdAt: string;
}

export interface AddNoteBody {
  text: string;
}

/** `POST /api/v1/cases/{caseId}/review` — ATANDI → INCELENIYOR. `If-Match` zorunludur. */
export interface StartReviewResponse {
  caseId: string;
  previousStatus: CaseStatus;
  status: CaseStatus;
  reviewStartedAt: string | null;
  version: number;
}

/** `POST /api/v1/cases/{caseId}/verification-requests` — INCELENIYOR → MUSTERI_DOGRULAMA. */
export interface RequestVerificationBody {
  message?: string | null;
}

export interface VerificationRequestResponse {
  verificationId: string;
  caseId: string;
  status: VerificationStatus;
  requestedAt: string;
  expiresAt: string;
  caseStatus: CaseStatus;
  version: number;
}

/** `POST /api/v1/cases/{caseId}/verification-responses` — müşteri yanıtı. */
export interface SubmitVerificationResponseBody {
  verificationId: string;
  response: VerificationResponse;
}

export interface SubmitVerificationResponseResult {
  verificationId: string;
  caseId: string;
  response: VerificationResponse;
  respondedAt: string;
  caseStatus: CaseStatus;
  transactionControlStatus: ControlStatus;
}

/** `GET /api/v1/customer/verifications/pending` — müşterinin cevap bekleyen doğrulamaları. */
export interface PendingVerificationResponse {
  verificationId: string;
  caseId: string;
  transactionId: string;
  transactionNo: string;
  amount: number;
  currency: string;
  transactionType: TransactionType;
  city: string;
  countryCode: string;
  occurredAt: string;
  requestedAt: string;
  expiresAt: string;
}

/**
 * `PATCH /api/v1/cases/{caseId}/decision` — INCELENIYOR → ONAYLANDI | BLOKLANDI.
 *
 * DESIGN.MD kural 1: bu işlem optimistic YAPILMAZ. Backend cevabı beklenir,
 * 409/412 gerçek kullanıcı durumu olarak gösterilir.
 */
export interface SubmitDecisionBody {
  decision: 'APPROVE' | 'BLOCK';
  note?: string | null;
  /** AI kararının tersine karar veriliyorsa gerekçe. */
  overrideReason?: string | null;
}

export interface SubmitDecisionSlaResponse {
  deadlineAt: string;
  stoppedAt: string | null;
  /** Karar SLA içinde verildiyse true — puanlamayı bu belirler. */
  compliant: boolean;
}

export interface SubmitDecisionResponse {
  caseId: string;
  previousStatus: CaseStatus;
  status: CaseStatus;
  decision: string;
  decisionNote: string | null;
  decidedBy: string;
  decidedAt: string;
  transactionControlStatus: ControlStatus;
  sla: SubmitDecisionSlaResponse;
  closureDueAt: string | null;
  version: number;
}

/** `PUT /api/v1/cases/{caseId}/assignment` — süpervizör manuel ataması. */
export interface ManualAssignmentBody {
  analystId: string;
  reason: string;
}

export interface ManualAssignmentResponse {
  caseId: string;
  assignedAnalystId: string;
  assignmentStatus: AssignmentStatus;
  caseStatus: CaseStatus;
  assignedAt: string;
  assignmentSource: AssignmentSource;
  version: number;
}

/** `POST /api/v1/cases/{caseId}/reassignments` — başka analiste devir. */
export interface ReassignmentBody {
  newAnalystId: string;
  reason: string;
}

export interface ReassignmentResponse {
  caseId: string;
  previousAnalystId: string | null;
  assignedAnalystId: string;
  reassignedAt: string;
  caseStatus: CaseStatus;
  version: number;
}

/** `PATCH /api/v1/cases/{caseId}/fraud-type` — süpervizör AI'ın tipini değiştirir. */
export interface FraudTypeOverrideBody {
  fraudType: FraudType;
  reason: string;
}

export interface FraudTypeOverrideResponse {
  caseId: string;
  /** AI'ın orijinal tahmini — override sonrası da saklanır. */
  aiFraudType: FraudType | null;
  previousEffectiveFraudType: FraudType;
  effectiveFraudType: FraudType;
  overriddenBy: string;
  overriddenAt: string;
  version: number;
}

/**
 * `PATCH /api/v1/cases/{caseId}/risk-level`
 *
 * Risk seviyesi değişince SLA yeniden hesaplanır — yanıt yeni deadline'ı taşır.
 */
export interface RiskLevelOverrideBody {
  riskLevel: RiskLevel;
  reason: string;
}

export interface RiskLevelOverrideSlaResponse {
  priority: SlaPriority;
  startedAt: string;
  deadlineAt: string;
  breachedAt: string | null;
}

export interface RiskLevelOverrideResponse {
  caseId: string;
  previousRiskLevel: RiskLevel;
  effectiveRiskLevel: RiskLevel;
  sla: RiskLevelOverrideSlaResponse;
  transactionControlStatus: ControlStatus;
  version: number;
}

/** `POST /api/v1/cases/{caseId}/feedback` — vaka kapandıktan sonra müşteri geri bildirimi. */
export interface SubmitFeedbackBody {
  rating: number;
  comment?: string | null;
}

export interface FeedbackResponse {
  feedbackId: string;
  caseId: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
}

/** `POST /api/v1/events/tickets` — tek kullanımlık, kısa ömürlü SSE bileti. */
export interface StreamTicketResponse {
  ticket: string;
  expiresAt: string;
}

/* ========================================================================== */
/*  Gamification — oyunlaştırma ve performans                                 */
/* ========================================================================== */

export const POINT_RULE_CODES = [
  'CASE_DECISION',
  'FAST_DECISION',
  'CONFIRMED_FRAUD',
  'CRITICAL_WITHIN_SLA',
  'SLA_BREACH',
  'FALSE_POSITIVE',
] as const;
export type PointRuleCode = (typeof POINT_RULE_CODES)[number];

export const ANALYST_LEVELS = ['BRONZ', 'GUMUS', 'ALTIN', 'PLATIN'] as const;
export type AnalystLevel = (typeof ANALYST_LEVELS)[number];

export type LeaderboardPeriod = 'daily' | 'weekly';

export interface BadgeDefinitionResponse {
  code: string;
  displayName: string;
  description: string;
}

export interface BadgeSummaryResponse {
  code: string;
  displayName: string;
  earnedAt: string;
}

export interface GamificationProfileResponse {
  analystId: string;
  displayName: string | null;
  totalPoints: number;
  level: AnalystLevel;
  dailyRank: number | null;
  weeklyRank: number | null;
  totalDecisions: number;
  averageDecisionSeconds: number | null;
  accuracyRate: number;
  badges: BadgeSummaryResponse[];
}

export interface PointLedgerItemResponse {
  ledgerId: string;
  caseId: string | null;
  ruleCode: PointRuleCode;
  points: number;
  description: string;
  occurredAt: string;
}

export interface FraudTypePerformanceResponse {
  fraudType: FraudType;
  decisionCount: number;
  confirmedFraudCount: number;
  accuracyRate: number;
}

export interface AnalystPerformanceResponse {
  analystId: string;
  totalDecisions: number;
  correctDecisions: number;
  falsePositiveCount: number;
  slaCompliantCount: number;
  slaBreachCount: number;
  averageDecisionSeconds: number | null;
  accuracyRate: number;
  fraudTypeBreakdown: FraudTypePerformanceResponse[];
}

export interface LeaderboardItemResponse {
  rank: number;
  analystId: string;
  displayName: string | null;
  points: number;
  level: AnalystLevel;
  decisionCount: number;
  badgeCount: number;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  periodStart: string;
  periodEnd: string;
  items: LeaderboardItemResponse[];
}

/* ========================================================================== */
/*  AI — model, tahmin ve ground-truth metrikleri                             */
/* ========================================================================== */

export interface AiMetricsOverviewResponse {
  sampleCount: number;
  fraudTypeAccuracy: number | null;
  decisionAgreementRate: number | null;
  falsePositiveRate: number | null;
  totalPredictions: number;
  modelBundleVersion: string | null;
  calculatedAt: string;
}

export interface AiCategoryAccuracyItemResponse {
  fraudType: FraudType | 'UNKNOWN';
  sampleCount: number;
  /** Same as precision; kept for older clients. */
  accuracy: number | null;
  /** Of the cases the AI put in this type, the share that really were this type. */
  precision: number | null;
  /** Of the cases really of this type, the share the AI found. */
  recall: number | null;
}

export interface AiCategoryAccuracyResponse {
  items: AiCategoryAccuracyItemResponse[];
}

export interface AiDecisionAgreementResponse {
  sampleCount: number;
  decisionAgreementRate: number | null;
}

export interface AiActiveModelResponse {
  bundleVersion: string;
  riskModel: {
    version: string | null;
    algorithm: string | null;
    calibrated: boolean;
  };
  fraudTypeModel: {
    version: string | null;
    algorithm: string | null;
  };
  activatedAt: string | null;
}

export interface AiModelVersionResponse {
  version: string;
  modelKind: string;
  algorithm: string;
  status: string;
  metrics: Record<string, unknown>;
  createdAt: string;
  activatedAt: string | null;
}

export interface AiPredictionResponse {
  assessmentId: string;
  transactionId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  decision: ScreeningDecision;
  fraudType: FraudType;
  reasonCodes: ReasonCodeResponse[];
  predictedAt: string;
}

/**
 * `GET /api/v1/ai/predictions/{assessmentId}/explanation`
 * ve `.../by-transaction/{transactionId}/explanation`.
 *
 * `source`: "gemini" → LLM anlatısı (cache'lenir); "deterministic" → reason
 * code'lardan üretilen yedek özet (LLM erişilemediğinde).
 */
export interface AiExplanationResponse {
  assessmentId: string;
  explanation: string;
  source: 'gemini' | 'deterministic';
  generatedAt: string | null;
}
