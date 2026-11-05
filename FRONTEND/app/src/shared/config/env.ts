/**
 * Çalışma zamanı yapılandırması.
 *
 * frontend ve API aynı origin'de yayınlanır,
 * tarayıcı yalnızca Gateway ile konuşur. Bu yüzden base URL varsayılan olarak
 * BOŞTUR — istekler `/api/v1/...` şeklinde göreli gider. Development'ta Vite
 * proxy'si, production'da Gateway'in kendisi karşılar.
 */

/** `mock`: MSW devrede, backend gerekmez. `live`: istekler Gateway'e gider. */
export type ApiMode = 'mock' | 'live';

function readMode(): ApiMode {
  const raw = import.meta.env.VITE_API_MODE;
  return raw === 'live' ? 'live' : 'mock';
}

export const env = {
  /**
   * Varsayılan `mock`. `live` mod tüm servis ve SSE akışlarına Gateway
   * üzerinden gider.
   */
  apiMode: readMode(),

  /** Göreli kalması kasıtlı — origin ayrımı yok, CORS yok. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',

  /** Kısa ömürlü stream ticket ile açılan Gateway SSE yolu. */
  eventsPath: '/api/v1/events',

  /** Mock modda kapalı, canlı scriptlerde açık. */
  realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === 'true',

  get isMock(): boolean {
    return this.apiMode === 'mock';
  },
} as const;

/** API sürüm öneki — tüm yollar bunun altında. */
export const API_PREFIX = '/api/v1';
