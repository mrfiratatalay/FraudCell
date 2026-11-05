import { QueryClient } from '@tanstack/react-query';
import { isAuthError, isRetryableError } from '@/shared/api/errors';

/**
 * TanStack Query yapılandırması.
 *
 * server state'in tek sahibi burasıdır. Vaka listeleri, SLA
 * durumları, dashboard metrikleri Redux/Zustand'a KOPYALANMAZ.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * SLA sayaçları ve vaka durumları hızlı eskiyor; 30 saniye taze
         * saymak sekme değiştirmede gereksiz istek üretmeden yeterince güncel
         * tutuyor. Asıl tazeleme SSE invalidation'ından geliyor.
         */
        staleTime: 30_000,
        gcTime: 5 * 60_000,

        /**
         * 401/403/404/422 gibi hataları tekrar denemek anlamsız — kullanıcıya
         * hemen gösterilmeli. Yalnızca ağ ve 5xx için 2 deneme.
         */
        retry: (failureCount, error) => {
          if (isAuthError(error)) return false;
          if (!isRetryableError(error)) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),

        // Pencereye her dönüşte tüm listeleri yenilemek demo sırasında
        // gürültü yaratıyor; SSE zaten güncelliyor.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        /**
         * Mutation'lar ASLA otomatik tekrar denenmez. `POST /transactions` ve
         * vaka kararları yan etkili; idempotency anahtarı olmadan tekrarlamak
         * çift kayıt üretir.
         */
        retry: false,
      },
    },
  });
}
