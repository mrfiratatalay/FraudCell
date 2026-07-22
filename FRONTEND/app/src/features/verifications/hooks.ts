import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import type {
  FeedbackResponse,
  PendingVerificationResponse,
  SubmitFeedbackBody,
  SubmitVerificationResponseBody,
  SubmitVerificationResponseResult,
} from '@/shared/api/contract';

/**
 * Müşteri doğrulama akışı (UX-CUS-005) ve geri bildirim (UX-CUS-007).
 *
 * DESIGN.MD kural 1: bu işlemler optimistic YAPILMAZ. "Ben yapmadım" cevabı
 * işlemi geçici bloka alan ve risk skorunu yükselten gerçek bir yan etki;
 * backend onaylamadan arayüzde onaylanmış gibi göstermek yanlış olur.
 */

export function usePendingVerifications() {
  return useQuery({
    queryKey: queryKeys.pendingVerifications,
    queryFn: () =>
      api
        .get<PendingVerificationResponse[]>(endpoints.customer.pendingVerifications)
        .then((r) => r.data),
  });
}

export function useRespondVerification(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SubmitVerificationResponseBody) =>
      api
        .post<SubmitVerificationResponseResult>(endpoints.cases.verificationResponses(caseId), {
          body,
        })
        .then((r) => r.data),

    onSuccess: () => {
      // Yanıt hem bekleyen listesini hem işlemin kontrol durumunu değiştirir.
      void queryClient.invalidateQueries({ queryKey: queryKeys.pendingVerifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
    },
  });
}

export function useSubmitFeedback(caseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SubmitFeedbackBody) =>
      api
        .post<FeedbackResponse>(endpoints.cases.feedback(caseId), { body })
        .then((r) => r.data),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}
