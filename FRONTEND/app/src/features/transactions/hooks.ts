import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/query-keys';
import type { CreateTransactionBody, ListTransactionsQuery } from '@/shared/api/contract';
import { transactionApi } from './api';

/**
 * İşlem query'leri.
 *
 * Liste `useInfiniteQuery` kullanıyor çünkü backend keyset (cursor) pagination
 * yapıyor — sayfa numarası yok, "daha fazla yükle" kalıbı zorunlu.
 */

export function useTransactions(filters: ListTransactionsQuery = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: ({ pageParam }) =>
      transactionApi.list({ ...filters, cursor: pageParam as string | null }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.page.nextCursor,
  });
}

export function useTransaction(transactionId: string) {
  return useQuery({
    queryKey: queryKeys.transactions.detail(transactionId),
    queryFn: () => transactionApi.getById(transactionId),
    /**
     * Değerlendirme asenkron: işlem PENDING doğar, AI sonrasında COMPLETED'a
     * geçer. Sonuç beklenirken 3 saniyede bir yokluyoruz.
     *
     * SSE de aynı anda invalidate ediyor; bu yoklama SSE'nin çalışmadığı
     * durumlar (mock mod, bağlantı kopuk) için yedek. Değerlendirme bitince
     * yoklama durur — sonsuza kadar istek atmayız.
     */
    refetchInterval: (query) => {
      const status = query.state.data?.assessment.status;
      return status === 'PENDING' ? 3000 : false;
    },
  });
}

/**
 * İşlem oluşturur.
 *
 * `Idempotency-Key` mutation dışında, ÇAĞIRAN EKRANDA üretilir ve saklanır;
 * burada üretilseydi her `mutate` çağrısı yeni anahtar alır ve "tekrar dene"
 * ikinci bir işlem yaratırdı.
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      body,
      idempotencyKey,
    }: {
      body: CreateTransactionBody;
      idempotencyKey: string;
    }) => transactionApi.create(body, idempotencyKey),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
