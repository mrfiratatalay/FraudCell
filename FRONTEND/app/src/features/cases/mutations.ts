import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import type {
  AddNoteBody,
  FraudTypeOverrideBody,
  FraudTypeOverrideResponse,
  ManualAssignmentBody,
  ManualAssignmentResponse,
  NoteResponse,
  ReassignmentBody,
  ReassignmentResponse,
  RequestVerificationBody,
  RiskLevelOverrideBody,
  RiskLevelOverrideResponse,
  StartReviewResponse,
  SubmitDecisionBody,
  SubmitDecisionResponse,
  VerificationRequestResponse,
} from '@/shared/api/contract';
import { applyCaseMutationResult, invalidateDecisionSideEffects } from './case-cache';

/**
 * Vaka yazma mutasyonları.
 *
 * Yedi mutasyonun yedisi de backend'de `ETagHelper.RequireIfMatch` kullanır
 * (İncelemeye al / Doğrulama iste / Karar ver / Manuel atama / Devir / Fraud
 * override / Risk override) — `endpoints.ts`'in yorumları yalnızca dördünü
 * belirtiyordu, gerçek endpoint kaynağına bakılarak doğrulandı. Hepsi burada
 * `ifMatch` parametresi alır.
 *
 * Hiçbiri optimistic değildir (DESIGN.MD kural 1): cache yalnızca
 * `onSuccess`'te, backend cevabı geldikten sonra güncellenir.
 */

export function useStartReviewMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ifMatch: number) =>
      api.post<StartReviewResponse>(endpoints.cases.review(caseId), { ifMatch }).then((r) => r.data),
    onSuccess: (data) => {
      applyCaseMutationResult(queryClient, caseId, { status: data.status, version: data.version });
    },
  });
}

export function useRequestVerificationMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ifMatch, body }: { ifMatch: number; body: RequestVerificationBody }) =>
      api
        .post<VerificationRequestResponse>(endpoints.cases.verificationRequests(caseId), { ifMatch, body })
        .then((r) => r.data),
    onSuccess: (data) => {
      applyCaseMutationResult(queryClient, caseId, { status: data.caseStatus, version: data.version });
    },
  });
}

export function useAddNoteMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      api
        .post<NoteResponse>(endpoints.cases.notes(caseId), { body: { text } satisfies AddNoteBody })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.notes(caseId) });
    },
  });
}

export function useSubmitDecisionMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ifMatch, body }: { ifMatch: number; body: SubmitDecisionBody }) =>
      api.patch<SubmitDecisionResponse>(endpoints.cases.decision(caseId), { ifMatch, body }).then((r) => r.data),
    onSuccess: (data) => {
      applyCaseMutationResult(queryClient, caseId, {
        status: data.status,
        finalDecision: data.decision,
        decisionNote: data.decisionNote,
        version: data.version,
      });
      // SSE mock modda bağlanmıyor — gamification/dashboard'u elle tazele.
      invalidateDecisionSideEffects(queryClient);
    },
  });
}

export function useManualAssignmentMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ifMatch, body }: { ifMatch: number; body: ManualAssignmentBody }) =>
      api.put<ManualAssignmentResponse>(endpoints.cases.assignment(caseId), { ifMatch, body }).then((r) => r.data),
    onSuccess: (data) => {
      applyCaseMutationResult(queryClient, caseId, {
        assignedAnalystId: data.assignedAnalystId,
        assignmentStatus: data.assignmentStatus,
        status: data.caseStatus,
        version: data.version,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.assignmentQueue('QUEUED') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.assignmentQueue('MANUAL_QUEUE') });
    },
  });
}

export function useReassignmentMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ifMatch, body }: { ifMatch: number; body: ReassignmentBody }) =>
      api.post<ReassignmentResponse>(endpoints.cases.reassignments(caseId), { ifMatch, body }).then((r) => r.data),
    onSuccess: (data) => {
      applyCaseMutationResult(queryClient, caseId, {
        assignedAnalystId: data.assignedAnalystId,
        status: data.caseStatus,
        version: data.version,
      });
    },
  });
}

export function useFraudTypeOverrideMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ifMatch, body }: { ifMatch: number; body: FraudTypeOverrideBody }) =>
      api.patch<FraudTypeOverrideResponse>(endpoints.cases.fraudType(caseId), { ifMatch, body }).then((r) => r.data),
    onSuccess: (data) => {
      // Yanıtın alan adı (`effectiveFraudType`) cache'teki iç içe alandan
      // (`effectiveRisk.fraudType`) farklı — körü körüne spread yerine
      // mevcut `effectiveRisk`i alanı değiştirerek koru.
      applyCaseMutationResult(queryClient, caseId, (current) => ({
        effectiveRisk: { ...current.effectiveRisk, fraudType: data.effectiveFraudType, overridden: true },
        version: data.version,
      }));
    },
  });
}

export function useRiskLevelOverrideMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ifMatch, body }: { ifMatch: number; body: RiskLevelOverrideBody }) =>
      api.patch<RiskLevelOverrideResponse>(endpoints.cases.riskLevel(caseId), { ifMatch, body }).then((r) => r.data),
    onSuccess: (data) => {
      applyCaseMutationResult(queryClient, caseId, (current) => ({
        effectiveRisk: { ...current.effectiveRisk, riskLevel: data.effectiveRiskLevel, overridden: true },
        sla: { ...current.sla, ...data.sla },
        version: data.version,
      }));
      // Yanıt SLA'nın yalnızca bir alt kümesini taşıyor (status/remainingSeconds
      // yok) — tam SLA durumunu sunucudan tazelemek için ayrıca invalidate et.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
    },
  });
}
