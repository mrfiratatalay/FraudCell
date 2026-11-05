/**
 * Backend enum'larının birebir karşılığı.
 *
 * Kaynak dosyalar:
 *   BACKEND/src/Services/Transaction/.../Domain/Enums.cs
 *   BACKEND/src/Services/Identity/.../Common/AnalystSpecialty.cs
 *   BACKEND/src/Services/Identity/.../Common/RoleNames.cs
 *
 * JsonDefaults.cs'te enum'lara KASITLI olarak naming policy uygulanmaz:
 * C# üye adı ne ise wire'da o çıkar (`CALINTI_KART`, `MUSTERI_DOGRULAMA`).
 * Bu yüzden aşağıdaki string'ler harfi harfine korunmalıdır.
 *
 * Her enum yanında ekranlarda gösterilecek Türkçe etiketi de tutuyoruz;
 * böylece etiket üretimi tek yerde kalır ve ekranlar kendi sözlüğünü yazmaz.
 */

/* ------------------------------------------------------------------ Roller -- */

export const ROLES = ['CUSTOMER', 'ANALYST', 'SUPERVISOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Müşteri',
  ANALYST: 'Analist',
  SUPERVISOR: 'Süpervizör',
  ADMIN: 'Yönetici',
};

/** Personel sayılan roller — müşteri bunların dışındadır (RoleNames.StaffRoles). */
export const STAFF_ROLES = ['ANALYST', 'SUPERVISOR', 'ADMIN'] as const satisfies readonly Role[];

export function isStaffRole(role: Role): boolean {
  return (STAFF_ROLES as readonly Role[]).includes(role);
}

/* ------------------------------------------------------- Uzmanlık / bölge -- */

/**
 * DİKKAT: AnalystSpecialty'de `TEMIZ` YOKTUR. `TEMIZ` AI'ın "şüpheli değil"
 * sınıfıdır, bir analist uzmanlığı değildir (Enums.cs §8 notu).
 */
export const ANALYST_SPECIALTIES = [
  'CALINTI_KART',
  'HESAP_ELE_GECIRME',
  'PARA_AKLAMA',
  'SUPHELI_DAVRANIS',
] as const;
export type AnalystSpecialty = (typeof ANALYST_SPECIALTIES)[number];

export const OPERATION_REGIONS = [
  'MARMARA',
  'EGE',
  'AKDENIZ',
  'IC_ANADOLU',
  'KARADENIZ',
  'DOGU_ANADOLU',
  'GUNEYDOGU_ANADOLU',
  'YURT_DISI',
] as const;
export type OperationRegion = (typeof OPERATION_REGIONS)[number];

export const REGION_LABEL: Record<OperationRegion, string> = {
  MARMARA: 'Marmara',
  EGE: 'Ege',
  AKDENIZ: 'Akdeniz',
  IC_ANADOLU: 'İç Anadolu',
  KARADENIZ: 'Karadeniz',
  DOGU_ANADOLU: 'Doğu Anadolu',
  GUNEYDOGU_ANADOLU: 'Güneydoğu Anadolu',
  YURT_DISI: 'Yurt Dışı',
};

/* ----------------------------------------------------------------- İşlem -- */

export const TRANSACTION_TYPES = ['ODEME', 'TRANSFER', 'FATURA', 'CEKIM'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  ODEME: 'Ödeme',
  TRANSFER: 'Transfer',
  FATURA: 'Fatura',
  CEKIM: 'Çekim',
};

/** İşlemin finansal/operasyonel kontrol durumu (Enums.cs §14). */
export const CONTROL_STATUSES = [
  'ALLOWED',
  'TEMPORARILY_BLOCKED',
  'APPROVED',
  'BLOCKED',
] as const;
export type ControlStatus = (typeof CONTROL_STATUSES)[number];

export const CONTROL_STATUS_LABEL: Record<ControlStatus, string> = {
  ALLOWED: 'İzin verildi',
  TEMPORARILY_BLOCKED: 'Geçici blokta',
  APPROVED: 'Onaylandı',
  BLOCKED: 'Bloklandı',
};

/* ------------------------------------------------------- AI değerlendirme -- */

/**
 * `TIMED_OUT` frontend sözleşmesinde yeni: AI servisi zamanında cevap
 * veremediğinde işlem kaybolmaz, bu durumda kalır.
 */
export const ASSESSMENT_STATUSES = ['PENDING', 'COMPLETED', 'TIMED_OUT', 'FAILED'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  PENDING: 'Değerlendiriliyor',
  COMPLETED: 'Tamamlandı',
  TIMED_OUT: 'Manuel incelemede',
  FAILED: 'Değerlendirme başarısız',
};

export const RISK_LEVELS = ['DUSUK', 'ORTA', 'YUKSEK', 'KRITIK'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  DUSUK: 'Düşük',
  ORTA: 'Orta',
  YUKSEK: 'Yüksek',
  KRITIK: 'Kritik',
};

/** Eşik kararı (Enums.cs §10): <0.40 ONAY, 0.40–0.90 INCELEME, >0.90 BLOK. */
export const SCREENING_DECISIONS = ['ONAY', 'INCELEME', 'BLOK'] as const;
export type ScreeningDecision = (typeof SCREENING_DECISIONS)[number];

export const SCREENING_DECISION_LABEL: Record<ScreeningDecision, string> = {
  ONAY: 'Onay',
  INCELEME: 'İnceleme',
  BLOK: 'Blok',
};

export const FRAUD_TYPES = [
  'CALINTI_KART',
  'HESAP_ELE_GECIRME',
  'PARA_AKLAMA',
  'SUPHELI_DAVRANIS',
  'TEMIZ',
] as const;
export type FraudType = (typeof FRAUD_TYPES)[number];

export const FRAUD_TYPE_LABEL: Record<FraudType, string> = {
  CALINTI_KART: 'Çalıntı Kart',
  HESAP_ELE_GECIRME: 'Hesap Ele Geçirme',
  PARA_AKLAMA: 'Para Aklama',
  SUPHELI_DAVRANIS: 'Şüpheli Davranış',
  TEMIZ: 'Temiz',
};

/** Reason code'un karara etkisi. */
export const REASON_IMPACTS = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type ReasonImpact = (typeof REASON_IMPACTS)[number];

/* ------------------------------------------------------------ Risk vakası -- */

export const CASE_STATUSES = [
  'YENI',
  'ATANDI',
  'INCELENIYOR',
  'MUSTERI_DOGRULAMA',
  'ONAYLANDI',
  'BLOKLANDI',
  'KAPANDI',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  YENI: 'Yeni',
  ATANDI: 'Atandı',
  INCELENIYOR: 'İnceleniyor',
  MUSTERI_DOGRULAMA: 'Müşteri Doğrulama',
  ONAYLANDI: 'Onaylandı',
  BLOKLANDI: 'Bloklandı',
  KAPANDI: 'Kapandı',
};

/**
 * Atama durumu vaka state'inden BAĞIMSIZDIR (Enums.cs §32) — vaka `YENI`
 * kalırken atama `QUEUED` olabilir.
 */
export const ASSIGNMENT_STATUSES = [
  'UNASSIGNED',
  'QUEUED',
  'MANUAL_QUEUE',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  UNASSIGNED: 'Atanmadı',
  QUEUED: 'Kuyrukta',
  MANUAL_QUEUE: 'Manuel kuyrukta',
  ASSIGNED: 'Atandı',
  IN_PROGRESS: 'Devam ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal edildi',
};

/** Süpervizörün atama kuyruğunda seçebildiği iki kuyruk. */
export const QUEUE_TYPES = ['ALL', 'QUEUED', 'MANUAL_QUEUE'] as const;
export type QueueType = (typeof QUEUE_TYPES)[number];

export const ASSIGNMENT_SOURCES = [
  'AI_RECOMMENDATION',
  'SYSTEM',
  'SUPERVISOR',
  'MANUAL_QUEUE',
] as const;
export type AssignmentSource = (typeof ASSIGNMENT_SOURCES)[number];

/** SLA süresi risk seviyesine göre belirlenir (Enums.cs §35). */
export const SLA_PRIORITIES = ['DUSUK', 'ORTA', 'YUKSEK', 'KRITIK'] as const;
export type SlaPriority = (typeof SLA_PRIORITIES)[number];

/**
 * SLA durumu backend'de hesaplanır (CaseSlaStatusCalculator):
 * geçen süre <%75 NORMAL, <%90 WARNING, üstü URGENT, deadline aşıldıysa BREACHED.
 * Frontend bunu KENDİ hesaplamaz; yalnızca geri sayımı canlı tutar.
 */
export const SLA_STATUSES = ['NORMAL', 'WARNING', 'URGENT', 'BREACHED'] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

export const SLA_STATUS_LABEL: Record<SlaStatus, string> = {
  NORMAL: 'Normal',
  WARNING: 'Uyarı',
  URGENT: 'Acil',
  BREACHED: 'SLA aşıldı',
};

/** Analistin nihai kararı. DİKKAT: `ONAYLANDI/BLOKLANDI` değil. */
export const FINAL_DECISIONS = ['APPROVE', 'BLOCK'] as const;
export type FinalDecision = (typeof FINAL_DECISIONS)[number];

export const FINAL_DECISION_LABEL: Record<FinalDecision, string> = {
  APPROVE: 'Onayla',
  BLOCK: 'Blokla',
};

export const TEMPORARY_BLOCK_REASONS = [
  'AI_CRITICAL_RISK',
  'CUSTOMER_NOT_MINE',
  'CRITICAL_SLA_BREACH',
  'SUPERVISOR_SECURITY_OVERRIDE',
] as const;
export type TemporaryBlockReason = (typeof TEMPORARY_BLOCK_REASONS)[number];

/* ----------------------------------------------------- Müşteri doğrulama -- */

export const VERIFICATION_STATUSES = ['PENDING', 'ANSWERED', 'EXPIRED', 'CANCELLED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Müşterinin cevabı. `NOT_MINE` risk skorunu yükseltir ve işlemi geçici bloka
 * alır; `NO_RESPONSE` süre dolduğunda sistem tarafından yazılır.
 */
export const VERIFICATION_RESPONSES = ['MINE', 'NOT_MINE', 'NO_RESPONSE'] as const;
export type VerificationResponse = (typeof VERIFICATION_RESPONSES)[number];

/** Müşteriye gösterilen iki seçenek — `NO_RESPONSE` kullanıcı seçimi değildir. */
export const CUSTOMER_VERIFICATION_CHOICES = ['MINE', 'NOT_MINE'] as const;
export type CustomerVerificationChoice = (typeof CUSTOMER_VERIFICATION_CHOICES)[number];

export const VERIFICATION_RESPONSE_LABEL: Record<VerificationResponse, string> = {
  MINE: 'Bu işlemi ben yaptım',
  NOT_MINE: 'Bu işlemi ben yapmadım',
  NO_RESPONSE: 'Yanıt verilmedi',
};

/* ---------------------------------------------------- Override / geçmiş -- */

export const OVERRIDE_TYPES = ['FRAUD_TYPE', 'RISK_LEVEL'] as const;
export type OverrideType = (typeof OVERRIDE_TYPES)[number];

export const TRANSITION_SOURCES = ['SYSTEM', 'ANALYST', 'SUPERVISOR', 'CUSTOMER'] as const;
export type TransitionSource = (typeof TRANSITION_SOURCES)[number];

export const TRANSITION_SOURCE_LABEL: Record<TransitionSource, string> = {
  SYSTEM: 'Sistem',
  ANALYST: 'Analist',
  SUPERVISOR: 'Süpervizör',
  CUSTOMER: 'Müşteri',
};

/* -------------------------------------------------------------------- OTP -- */

/**
 * OtpPurpose C# tarafında PascalCase üyelerdir (`CustomerRegister`) ve
 * JsonStringEnumConverter naming policy'siz çalıştığı için wire'da da
 * PascalCase görünür. Diğer enum'lardaki SCREAMING_SNAKE kalıbı burada geçerli
 * DEĞİLDİR; yazım birebir korunmalıdır.
 */
export const OTP_PURPOSES = ['CustomerRegister', 'CustomerLogin'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/* ------------------------------------------------------------- Denetim -- */

export const AUDIT_RESULTS = ['SUCCESS', 'FAILURE'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];
