/**
 * FraudCell HTTP client.
 *
 * native `fetch` + tipli sarmalayıcı yeterli.
 *
 * Sorumlulukları:
 *   - `ApiEnvelope` açma: `data`yı döndürür, `error`ı `ApiRequestError`a çevirir
 *   - Access token'ı Authorization header'ına koyma (bellekten, köprü üzerinden)
 *   - 401'de TEK SEFER refresh + isteği yeniden deneme (single-flight)
 *   - `If-Match` / `ETag` ile optimistic concurrency
 *   - `Idempotency-Key` gönderme
 *   - Refresh cookie'si için `credentials: 'include'`
 *
 * Sorumluluğu OLMAYAN: retry politikası, cache, invalidation. Onlar
 * TanStack Query'nin işi.
 */

import { API_PREFIX, env } from '@/shared/config/env';
import { getAccessToken, notifySessionLost, refreshAccessToken } from './auth-bridge';
import type { ApiEnvelope, CursorPage } from './contract';
import { ApiRequestError, ERROR_CODES } from './errors';

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  /** Sorgu parametreleri. null/undefined olanlar URL'e yazılmaz. */
  query?: Record<string, QueryValue>;
  /** JSON gövde. GET/DELETE'te verilmez. */
  body?: unknown;
  /**
   * Optimistic concurrency. Verilirse `If-Match: "N"` gönderilir.
   * Backend eksikse 428, uyuşmazsa 412 döndürür (ETagHelper).
   */
  ifMatch?: number;
  /** `POST /transactions` için ZORUNLU. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /**
   * true ise 401'de refresh denenmez. Refresh/login uçlarının kendisi için —
   * aksi hâlde sonsuz döngü olur.
   */
  skipAuthRefresh?: boolean;
}

/** Yanıt gövdesiyle birlikte concurrency için gereken ETag. */
export interface ApiResult<T> {
  data: T;
  /** `ETag` header'ından okunan versiyon. Yoksa null. */
  etag: number | null;
  traceId: string | null;
  /** Aynı Idempotency-Key ile daha önce oluşturulmuş kaydın tekrarı. */
  replayed: boolean;
}

/* --------------------------------------------------------------- yardımcı -- */

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = `${env.apiBaseUrl}${API_PREFIX}${path}`;
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.append(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function parseETag(raw: string | null): number | null {
  if (!raw) return null;
  // Backend `ETag: "12"` yazar; tırnakları ve zayıf ETag önekini temizle.
  const cleaned = raw.replace(/^W\//, '').replace(/"/g, '').trim();
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Gövdeyi okur. Backend her zaman zarf döndürür, ancak 204 ve proxy/gateway
 * kaynaklı HTML hata sayfaları için savunmalı davranırız.
 */
async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    // Zarf değil — büyük ihtimalle Gateway ya da proxy hata sayfası döndü.
    throw new ApiRequestError({
      status: response.status,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: `Sunucudan beklenmeyen bir yanıt geldi (HTTP ${response.status}).`,
    });
  }
}

/* ------------------------------------------------------- refresh tek uçuş -- */

/**
 * Aynı anda 5 sorgu 401 alırsa 5 refresh isteği atılmamalı: ilk çağrı
 * promise'i tutar, diğerleri ona bağlanır.
 */
let inFlightRefresh: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  inFlightRefresh ??= refreshAccessToken().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

/* ----------------------------------------------------------------- istek -- */

async function send<T>(
  method: string,
  path: string,
  options: RequestOptions,
  isRetry: boolean,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.ifMatch !== undefined) {
    headers['If-Match'] = `"${options.ifMatch}"`;
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // Refresh token Secure/HttpOnly cookie'de taşındığı için şart.
      credentials: 'include',
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw ApiRequestError.network('Sunucuya ulaşılamadı.');
  }

  const envelope = await readEnvelope<T>(response);
  const traceId = envelope?.meta?.traceId ?? null;

  if (response.ok && (envelope === null || envelope.success)) {
    return {
      // 204'te gövde yok; çağıran taraf `void` bekliyordur.
      data: (envelope?.data ?? undefined) as T,
      etag: parseETag(response.headers.get('ETag')),
      traceId,
      replayed: response.headers.get('Idempotency-Replayed') === 'true',
    };
  }

  const error =
    envelope && !envelope.success
      ? ApiRequestError.fromEnvelope(response.status, envelope.error, traceId)
      : new ApiRequestError({
          status: response.status,
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `İstek başarısız oldu (HTTP ${response.status}).`,
          traceId,
        });

  // 401: access token süresi dolmuş olabilir. Bir kez refresh dene.
  const canRefresh = !isRetry && !options.skipAuthRefresh && response.status === 401;
  if (canRefresh) {
    const renewed = await refreshOnce();
    if (renewed) {
      return send<T>(method, path, options, true);
    }
    notifySessionLost();
  }

  throw error;
}

/* ------------------------------------------------------------------ API -- */

export const api = {
  get: <T>(path: string, options: RequestOptions = {}) => send<T>('GET', path, options, false),

  post: <T>(path: string, options: RequestOptions = {}) => send<T>('POST', path, options, false),

  put: <T>(path: string, options: RequestOptions = {}) => send<T>('PUT', path, options, false),

  patch: <T>(path: string, options: RequestOptions = {}) => send<T>('PATCH', path, options, false),

  delete: <T>(path: string, options: RequestOptions = {}) =>
    send<T>('DELETE', path, options, false),
};

/* -------------------------------------------------------------- kısayollar -- */

/**
 * Yalnızca gövdeyi isteyen çağrılar için. ETag'e ihtiyaç duyan yerler
 * (vaka detayı, personel kaydı) `api.*` kullanıp `etag`i saklamalıdır.
 */
export async function fetchData<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const result = await api.get<T>(path, options);
  return result.data;
}

/**
 * Cursor sayfasını çeker. TanStack Query'nin `useInfiniteQuery`si
 * `getNextPageParam: (last) => last.page.nextCursor` ile bunu kullanır.
 */
export async function fetchPage<T>(
  path: string,
  options: RequestOptions = {},
): Promise<CursorPage<T>> {
  const result = await api.get<CursorPage<T>>(path, options);
  return result.data;
}

/**
 * `POST /transactions` gibi idempotency anahtarı zorunlu uçlar için.
 * Anahtarı çağıran taraf üretip SAKLAMALIDIR: kullanıcı "tekrar dene"
 * dediğinde aynı anahtar gitmeli ki ikinci bir işlem oluşmasın.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
