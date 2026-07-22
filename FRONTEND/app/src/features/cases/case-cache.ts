import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/query-keys';
import type { CaseResponse } from '@/shared/api/contract';

/**
 * Her case mutasyonunun ortak sonrası.
 *
 * DESIGN.MD kural 1: approve/block (ve diğer mutasyonlar) optimistic
 * DEĞİLDİR. Bu fonksiyon yalnızca mutasyonun `onSuccess`'inde, backend
 * cevabı geldikten SONRA çağrılır — çağrılmadan önce hiçbir ekran durumu
 * değişmez.
 *
 * `updater` bazı yanıtların (fraud-type/risk-level override) alan adı
 * cache'teki iç içe şekilden farklı olduğu ya da yalnızca bir alt kümesini
 * taşıdığı için fonksiyon biçiminde de verilebilir — böylece mutasyon kendi
 * eşlemesini yazar, burası körü körüne spread yapmaz.
 */
export function applyCaseMutationResult(
  queryClient: QueryClient,
  caseId: string,
  updater: Partial<CaseResponse> | ((current: CaseResponse) => Partial<CaseResponse>),
): void {
  queryClient.setQueryData<CaseResponse | undefined>(queryKeys.cases.detail(caseId), (current) => {
    if (!current) return current;
    const patch = typeof updater === 'function' ? updater(current) : updater;
    return { ...current, ...patch };
  });

  // `['cases']` kökü hem `cases.all`, hem `cases.assigned(*)`, hem de
  // `cases.detail(caseId)` varyantlarını kapsar — liste ekranları bir
  // sonraki fetch'te sunucudan tazelenir.
  void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
}

/**
 * Karar mutasyonuna özel: dashboard ve gamification'ı elle invalidate eder.
 *
 * Gerçek backend bu güncellemeyi SSE ile ayrıca gönderir; ancak mock modda
 * SSE hiç bağlanmıyor (`features/realtime/useRealtime.ts`), bu yüzden bu
 * ekranların gerçek servis gelene kadar güncellenmesi bu çağrıya bağlıdır.
 */
export function invalidateDecisionSideEffects(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });
}
