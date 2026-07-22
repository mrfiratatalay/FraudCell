import { api, fetchPage, newIdempotencyKey } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import type {
  CreateTransactionBody,
  CreateTransactionResponse,
  CursorPage,
  ListTransactionsQuery,
  TransactionDetailResponse,
  TransactionListItemResponse,
} from '@/shared/api/contract';

/** İşlem uçlarının çağrı katmanı. */

export const transactionApi = {
  list: (query: ListTransactionsQuery = {}) =>
    // `query` bilinen alanlardan oluştuğu için `Record<string, QueryValue>`a
    // doğrudan atanamıyor (index signature yok); tek tek yazmak yerine
    // burada genişletiyoruz.
    fetchPage<TransactionListItemResponse>(endpoints.transactions.root, {
      query: {
        cursor: query.cursor ?? undefined,
        limit: query.limit,
        customerId: query.customerId,
        assessmentStatus: query.assessmentStatus,
        riskLevel: query.riskLevel,
      },
    }) as Promise<CursorPage<TransactionListItemResponse>>,

  getById: (transactionId: string) =>
    api
      .get<TransactionDetailResponse>(endpoints.transactions.byId(transactionId))
      .then((r) => r.data),

  /**
   * İşlem oluşturur.
   *
   * `Idempotency-Key` backend'de ZORUNLU. Anahtar çağıran tarafta üretilip
   * SAKLANMALIDIR: kullanıcı "tekrar dene" dediğinde aynı anahtar gitmeli ki
   * ikinci bir işlem oluşmasın. Bu yüzden fonksiyon anahtarı kendi üretmiyor,
   * dışarıdan alıyor.
   */
  create: (body: CreateTransactionBody, idempotencyKey: string) =>
    api
      .post<CreateTransactionResponse>(endpoints.transactions.root, {
        body,
        idempotencyKey,
      })
      .then((r) => r.data),
};

export { newIdempotencyKey };
