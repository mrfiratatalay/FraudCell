/**
 * Backend hata kodlarının frontend karşılığı.
 *
 * Kaynak: BACKEND/src/BuildingBlocks/FraudCell.BuildingBlocks/Api/ErrorCodes.cs
 *
 * Kodlar sabittir çünkü ekranlar bunlara göre davranış değiştirir (örneğin
 * ACCOUNT_LOCKED ayrı bir ekran açar). Mesajları burada tek yerde topluyoruz;
 * ekranlar `messageFor(error)` çağırır, kendi metnini uydurmaz.
 */

import type { ApiError } from './contract';

export const ERROR_CODES = {
  // --- Genel ---
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_ENUM_VALUE: 'INVALID_ENUM_VALUE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_FILTER: 'UNSUPPORTED_FILTER',
  UNSUPPORTED_SORT: 'UNSUPPORTED_SORT',
  INVALID_CURSOR: 'INVALID_CURSOR',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INTERNAL_OPERATION_FAILED: 'INTERNAL_OPERATION_FAILED',
  SERVICE_TEMPORARILY_UNAVAILABLE: 'SERVICE_TEMPORARILY_UNAVAILABLE',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',

  // --- Kimlik doğrulama ---
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  PASSWORD_POLICY_VIOLATION: 'PASSWORD_POLICY_VIOLATION',
  OTP_CHALLENGE_NOT_FOUND: 'OTP_CHALLENGE_NOT_FOUND',
  OTP_CHALLENGE_EXPIRED: 'OTP_CHALLENGE_EXPIRED',
  OTP_CHALLENGE_LOCKED: 'OTP_CHALLENGE_LOCKED',
  OTP_CODE_INVALID: 'OTP_CODE_INVALID',
  OTP_ALREADY_VERIFIED: 'OTP_ALREADY_VERIFIED',
  ACCESS_TOKEN_EXPIRED: 'ACCESS_TOKEN_EXPIRED',
  ACCESS_TOKEN_INVALID: 'ACCESS_TOKEN_INVALID',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  REFRESH_TOKEN_REUSE_DETECTED: 'REFRESH_TOKEN_REUSE_DETECTED',
  GSM_NUMBER_ALREADY_REGISTERED: 'GSM_NUMBER_ALREADY_REGISTERED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',

  // --- Yetkilendirme ---
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',
  ROLE_NOT_ALLOWED: 'ROLE_NOT_ALLOWED',
  CASE_NOT_ASSIGNED_TO_ACTOR: 'CASE_NOT_ASSIGNED_TO_ACTOR',
  CUSTOMER_NOT_OWNER: 'CUSTOMER_NOT_OWNER',

  // --- İşlem ---
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  INVALID_TRANSACTION_AMOUNT: 'INVALID_TRANSACTION_AMOUNT',
  UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD:
    'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',

  // --- Vaka ---
  CASE_NOT_FOUND: 'CASE_NOT_FOUND',
  INVALID_CASE_TRANSITION: 'INVALID_CASE_TRANSITION',
  CASE_ALREADY_DECIDED: 'CASE_ALREADY_DECIDED',
  CASE_ALREADY_CLOSED: 'CASE_ALREADY_CLOSED',
  DECISION_NOTE_REQUIRED: 'DECISION_NOTE_REQUIRED',
  CUSTOMER_VERIFICATION_ALREADY_PENDING: 'CUSTOMER_VERIFICATION_ALREADY_PENDING',
  ANALYST_CAPACITY_EXCEEDED: 'ANALYST_CAPACITY_EXCEEDED',
  ANALYST_NOT_ASSIGNABLE: 'ANALYST_NOT_ASSIGNABLE',
  VERIFICATION_NOT_PENDING: 'VERIFICATION_NOT_PENDING',
  FEEDBACK_NOT_ALLOWED: 'FEEDBACK_NOT_ALLOWED',
  FEEDBACK_ALREADY_SUBMITTED: 'FEEDBACK_ALREADY_SUBMITTED',
  ASSESSMENT_ALREADY_APPLIED: 'ASSESSMENT_ALREADY_APPLIED',

  // --- Eşzamanlılık ---
  PRECONDITION_REQUIRED: 'PRECONDITION_REQUIRED',
  RESOURCE_VERSION_MISMATCH: 'RESOURCE_VERSION_MISMATCH',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Backend'in döndürdüğü hatanın tipli hâli.
 *
 * `status` HTTP durum kodudur; `code` davranış dallanması için kullanılır.
 * Ağ hatası gibi backend'e hiç ulaşamadığımız durumlarda `status` 0 olur.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | null;
  readonly traceId: string | null;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
    traceId?: string | null;
  }) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? null;
    this.traceId = init.traceId ?? null;
  }

  static fromEnvelope(status: number, error: ApiError, traceId: string | null): ApiRequestError {
    return new ApiRequestError({
      status,
      code: error.code,
      message: error.message,
      details: error.details ?? null,
      traceId,
    });
  }

  /** Backend'e hiç ulaşamadık (offline, DNS, CORS, iptal). */
  static network(message: string): ApiRequestError {
    return new ApiRequestError({ status: 0, code: 'NETWORK_ERROR', message });
  }

  is(...codes: string[]): boolean {
    return codes.includes(this.code);
  }
}

export function isApiError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

/**
 * Ekranda gösterilecek Türkçe mesaj.
 *
 * Backend zaten Türkçe mesaj döndürüyor; ancak teknik kodlar için kullanıcıya
 * dönük daha anlaşılır bir karşılık veriyoruz. Katalogda olmayan kodlarda
 * backend'in kendi mesajına düşeriz — sessizce "bir hata oluştu" demeyiz.
 */
const MESSAGES: Partial<Record<string, string>> = {
  NETWORK_ERROR: 'Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.',

  VALIDATION_FAILED: 'Girdiğin bilgilerde bir sorun var.',
  NOT_FOUND: 'Aradığın kayıt bulunamadı.',
  FORBIDDEN: 'Bu işlem için yetkin yok.',
  ROLE_NOT_ALLOWED: 'Bu işlem için yetkin yok.',
  RESOURCE_ACCESS_DENIED: 'Bu kayda erişim yetkin yok.',
  RATE_LIMIT_EXCEEDED: 'Çok fazla deneme yaptın. Lütfen biraz bekle.',
  INTERNAL_ERROR: 'Beklenmeyen bir hata oluştu. Tekrar dener misin?',
  SERVICE_TEMPORARILY_UNAVAILABLE: 'Servis şu anda yanıt vermiyor. Kısa süre sonra tekrar dene.',
  DATABASE_UNAVAILABLE: 'Servis şu anda yanıt vermiyor. Kısa süre sonra tekrar dene.',

  INVALID_CREDENTIALS: 'E-posta veya şifre hatalı.',
  ACCOUNT_LOCKED: 'Hesabın çok sayıda hatalı denemeden dolayı kilitlendi.',
  AUTHENTICATION_REQUIRED: 'Devam etmek için giriş yapmalısın.',
  OTP_CODE_INVALID: 'Girdiğin kod hatalı.',
  OTP_CHALLENGE_EXPIRED: 'Kodun süresi doldu. Yeni kod iste.',
  OTP_CHALLENGE_LOCKED: 'Çok fazla hatalı kod girdin. Yeni kod iste.',
  OTP_CHALLENGE_NOT_FOUND: 'Doğrulama isteği bulunamadı. Baştan başla.',
  GSM_NUMBER_ALREADY_REGISTERED: 'Bu numara zaten kayıtlı.',
  EMAIL_ALREADY_REGISTERED: 'Bu e-posta zaten kayıtlı.',

  TRANSACTION_NOT_FOUND: 'İşlem bulunamadı.',
  INVALID_TRANSACTION_AMOUNT: 'Girdiğin tutar geçerli değil.',
  UNSUPPORTED_CURRENCY: 'Bu para birimi desteklenmiyor.',
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD:
    'Bu işlem farklı bilgilerle daha önce gönderilmiş. Sayfayı yenileyip tekrar dene.',

  CASE_NOT_FOUND: 'Vaka bulunamadı.',
  CASE_NOT_ASSIGNED_TO_ACTOR: 'Bu vaka sana atanmamış.',
  INVALID_CASE_TRANSITION: 'Vaka bu durumdayken bu işlem yapılamaz.',
  CASE_ALREADY_DECIDED: 'Bu vaka için karar zaten verilmiş.',
  CASE_ALREADY_CLOSED: 'Bu vaka kapanmış.',
  DECISION_NOTE_REQUIRED: 'Karar için not girmen gerekiyor.',
  CUSTOMER_VERIFICATION_ALREADY_PENDING: 'Bu vaka için bekleyen bir müşteri doğrulaması var.',
  ANALYST_CAPACITY_EXCEEDED: 'Analistin aktif vaka kapasitesi dolu.',
  ANALYST_NOT_ASSIGNABLE: 'Analist aktif değil ya da atamaya kapalı.',
  VERIFICATION_NOT_PENDING: 'Bu doğrulama isteği artık yanıtlanamaz.',
  FEEDBACK_NOT_ALLOWED: 'Bu vaka için geri bildirim verilemez.',
  FEEDBACK_ALREADY_SUBMITTED: 'Bu vaka için geri bildirimini zaten verdin.',

  PRECONDITION_REQUIRED: 'İşlem gönderilemedi. Sayfayı yenileyip tekrar dene.',
  RESOURCE_VERSION_MISMATCH:
    'Bu kayıt sen bakarken başkası tarafından değiştirildi. Yenileyip tekrar dene.',
  CONCURRENCY_CONFLICT:
    'Bu kayıt sen bakarken başkası tarafından değiştirildi. Yenileyip tekrar dene.',
};

export function messageFor(error: unknown): string {
  if (isApiError(error)) {
    return MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Beklenmeyen bir hata oluştu.';
}

/**
 * Başka bir kullanıcı aynı kaydı değiştirmiş demektir.
 *
 * Bu ikisi kural gereği gerçek kullanıcı durumu olarak gösterilir:
 * sessizce yeniden denenmez, kullanıcıya kaydı yenilemesi söylenir.
 */
export function isConcurrencyError(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.is(
      ERROR_CODES.RESOURCE_VERSION_MISMATCH,
      ERROR_CODES.CONCURRENCY_CONFLICT,
      ERROR_CODES.PRECONDITION_REQUIRED,
    )
  );
}

/** Oturum düşmüş; kullanıcı giriş ekranına alınmalı. */
export function isAuthError(error: unknown): boolean {
  return (
    isApiError(error) &&
    (error.status === 401 ||
      error.is(
        ERROR_CODES.AUTHENTICATION_REQUIRED,
        ERROR_CODES.ACCESS_TOKEN_EXPIRED,
        ERROR_CODES.ACCESS_TOKEN_INVALID,
        ERROR_CODES.REFRESH_TOKEN_INVALID,
        ERROR_CODES.REFRESH_TOKEN_EXPIRED,
        ERROR_CODES.REFRESH_TOKEN_REUSE_DETECTED,
      ))
  );
}

/**
 * Sunucu/altyapı kaynaklı, tekrar denemenin anlamlı olduğu hatalar.
 * TanStack Query'nin retry kararı bunu kullanır.
 */
export function isRetryableError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.status === 0) return true;
  if (error.status === 429) return true;
  return error.status >= 500;
}
