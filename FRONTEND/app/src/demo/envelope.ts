import { HttpResponse } from 'msw';
import type { ApiFailure, ApiSuccess, CursorPage, PageInfo } from '@/shared/api/contract';

/**
 * MSW yanıtlarının backend zarfıyla BİREBİR aynı şekli üretmesi için ortak
 * yardımcılar.
 *
 * Mock'un gerçek backend'den farklı bir şekil döndürmesi en sinsi hata
 * türüdür: ekranlar mock'ta çalışır, `live` moda geçince sessizce bozulur.
 * Bu yüzden zarfı elle yazmak yerine hep bu fonksiyonlar kullanılmalı.
 */

function traceId(): string {
  return crypto.randomUUID();
}

export function ok<T>(data: T, init: { pagination?: PageInfo; generatedAt?: string } = {}) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    error: null,
    meta: {
      traceId: traceId(),
      pagination: init.pagination ?? null,
      generatedAt: init.generatedAt ?? null,
    },
  };
  return HttpResponse.json(body);
}

/** 201 Created — `POST /transactions` gibi kaynak yaratan uçlar. */
export function created<T>(data: T, location?: string) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    error: null,
    meta: { traceId: traceId(), pagination: null, generatedAt: null },
  };
  return HttpResponse.json(body, {
    status: 201,
    headers: location ? { Location: location } : undefined,
  });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  const body: ApiFailure = {
    success: false,
    data: null,
    error: { code, message, details: details ?? null },
    meta: { traceId: traceId(), pagination: null, generatedAt: null },
  };
  return HttpResponse.json(body, { status });
}

/**
 * Cursor sayfası üretir.
 *
 * Backend `CursorCodec` ile `CreatedAt`i base64'ler. Mock'ta indeks tabanlı
 * basit bir cursor yeterli — önemli olan ŞEKLİN aynı olması: `{items, page}`
 * ve `page.nextCursor`/`hasMore`. Ekranlar "daha fazla yükle" mantığını buna
 * göre yazacak.
 */
export function paginate<T>(all: T[], cursor: string | null, limit: number): CursorPage<T> {
  const start = cursor ? Number.parseInt(atob(cursor), 10) : 0;
  const safeStart = Number.isFinite(start) && start >= 0 ? start : 0;

  const slice = all.slice(safeStart, safeStart + limit);
  const nextIndex = safeStart + limit;
  const hasMore = nextIndex < all.length;

  return {
    items: slice,
    page: {
      nextCursor: hasMore ? btoa(String(nextIndex)) : null,
      hasMore,
      limit,
    },
  };
}

/** Sorgu parametresinden limit okur; backend gibi 1–100 aralığına kırpar. */
export function readLimit(url: URL, fallback = 20): number {
  const raw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(raw, 1), 100);
}

/**
 * `If-Match` header'ını okur ve versiyonu doğrular.
 *
 * Backend `ETagHelper` ile aynı davranış: header yoksa 428, uyuşmuyorsa 412.
 * Mock'ta bunu atlamak, 409/412 ekranlarının hiç test edilmemesi demek olurdu
 * — oysa ürün bunları gerçek kullanıcı durumu olarak istiyor.
 */
export function checkIfMatch(request: Request, currentVersion: number) {
  const raw = request.headers.get('If-Match');
  if (!raw) {
    return fail(
      428,
      'PRECONDITION_REQUIRED',
      "Bu işlem için If-Match header'ı zorunludur.",
    );
  }

  const expected = Number.parseInt(raw.replace(/^W\//, '').replace(/"/g, '').trim(), 10);
  if (!Number.isFinite(expected)) {
    return fail(400, 'VALIDATION_FAILED', "If-Match header'ı geçerli bir versiyon içermelidir.");
  }

  if (expected !== currentVersion) {
    return fail(412, 'RESOURCE_VERSION_MISMATCH', 'Kaynak versiyonu uyuşmuyor.', {
      expectedVersion: expected,
      currentVersion,
    });
  }

  return null;
}

/** `ETag` header'ını yanıta ekler. */
export function withETag(response: Response, version: number): Response {
  response.headers.set('ETag', `"${version}"`);
  return response;
}
