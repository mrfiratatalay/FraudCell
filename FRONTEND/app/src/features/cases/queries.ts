import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { endpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import { fetchData, fetchPage } from '@/shared/api/client';
import type {
  AssignmentQueueItemResponse,
  CaseResponse,
  CaseTransitionResponse,
  NoteResponse,
} from '@/shared/api/contract';
import type { CaseStatus, QueueType, RiskLevel } from '@/shared/api/enums';

/**
 * Vaka okuma sorguları.
 *
 * `GET /cases/assigned` ve `GET /cases/assignment-queue` sözleşmede
 * `CursorPage` sarmalıysa da gerçek cursor'a sahip DEĞİLDİR: analist kuyruğu
 * `ListAssignedCasesQuery`'de cursor alanını kasıtlı içermez (sınırlı liste),
 * kuyruk ise backend'de `hasMore`ı her zaman `false` döner. Bu yüzden ikisi
 * de düz `useQuery` — yalnızca `GET /cases` gerçek `useInfiniteQuery`.
 */

export function useAssignedCasesQuery(filters: { status?: CaseStatus; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.cases.assigned(filters),
    queryFn: () => fetchPage<CaseResponse>(endpoints.cases.assigned, { query: filters }),
  });
}

export function useAssignmentQueueQuery(queueType: QueueType, limit?: number) {
  return useQuery({
    queryKey: queryKeys.cases.assignmentQueue(queueType),
    queryFn: () =>
      fetchPage<AssignmentQueueItemResponse>(endpoints.cases.assignmentQueue, {
        query: { queueType, limit },
      }),
  });
}

export function useAllCasesInfiniteQuery(
  filters: { status?: CaseStatus; riskLevel?: RiskLevel } = {},
) {
  return useInfiniteQuery({
    queryKey: queryKeys.cases.list(filters),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchPage<CaseResponse>(endpoints.cases.root, {
        query: { ...filters, cursor: pageParam, limit: 20 },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.page.nextCursor,
  });
}

export function useCaseDetailQuery(caseId: string) {
  return useQuery({
    queryKey: queryKeys.cases.detail(caseId),
    queryFn: () => fetchData<CaseResponse>(endpoints.cases.byId(caseId)),
  });
}

export function useCaseHistoryQuery(caseId: string) {
  return useQuery({
    queryKey: queryKeys.cases.history(caseId),
    queryFn: () => fetchData<CaseTransitionResponse[]>(endpoints.cases.history(caseId)),
  });
}

export function useCaseNotesQuery(caseId: string) {
  return useQuery({
    queryKey: queryKeys.cases.notes(caseId),
    queryFn: () => fetchData<NoteResponse[]>(endpoints.cases.notes(caseId)),
  });
}
