import { api, fetchPage, type ApiResult } from '@/shared/api/client';
import type {
  CaseResponse,
  CursorPage,
  AssignmentQueueItemResponse,
  AssignmentQueueQuery,
  FraudTypeOverrideBody,
  FraudTypeOverrideResponse,
  ListCasesQuery,
  ListAssignedCasesQuery,
  ManualAssignmentBody,
  ManualAssignmentResponse,
  ReassignmentBody,
  ReassignmentResponse,
  RiskLevelOverrideBody,
  RiskLevelOverrideResponse,
  StartReviewResponse,
  SubmitDecisionBody,
  SubmitDecisionResponse,
  FeedbackResponse,
  SubmitFeedbackBody,
} from '@/shared/api/contract';
import { endpoints } from '@/shared/api/endpoints';

export function listAssignedCases(
  query: ListAssignedCasesQuery = {},
): Promise<CursorPage<CaseResponse>> {
  return fetchPage(endpoints.cases.assigned, { query: { ...query } });
}

export function listCases(query: ListCasesQuery = {}): Promise<CursorPage<CaseResponse>> {
  return fetchPage(endpoints.cases.root, { query: { ...query } });
}

export function listAssignmentQueue(
  query: AssignmentQueueQuery = {},
): Promise<CursorPage<AssignmentQueueItemResponse>> {
  return fetchPage(endpoints.cases.assignmentQueue, { query: { ...query } });
}

export function getCase(caseId: string): Promise<ApiResult<CaseResponse>> {
  return api.get(endpoints.cases.byId(caseId));
}

export function startCaseReview(
  caseId: string,
  version: number,
): Promise<ApiResult<StartReviewResponse>> {
  return api.post(endpoints.cases.review(caseId), { ifMatch: version });
}

export function submitCaseDecision(
  caseId: string,
  version: number,
  body: SubmitDecisionBody,
): Promise<ApiResult<SubmitDecisionResponse>> {
  return api.patch(endpoints.cases.decision(caseId), { body, ifMatch: version });
}

export function assignCase(
  caseId: string,
  version: number,
  body: ManualAssignmentBody,
): Promise<ApiResult<ManualAssignmentResponse>> {
  return api.put(endpoints.cases.assignment(caseId), { body, ifMatch: version });
}

export function reassignCase(
  caseId: string,
  version: number,
  body: ReassignmentBody,
): Promise<ApiResult<ReassignmentResponse>> {
  return api.post(endpoints.cases.reassignments(caseId), { body, ifMatch: version });
}

export function overrideCaseRisk(
  caseId: string,
  version: number,
  body: RiskLevelOverrideBody,
): Promise<ApiResult<RiskLevelOverrideResponse>> {
  return api.patch(endpoints.cases.riskLevel(caseId), { body, ifMatch: version });
}

export function overrideCaseFraudType(
  caseId: string,
  version: number,
  body: FraudTypeOverrideBody,
): Promise<ApiResult<FraudTypeOverrideResponse>> {
  return api.patch(endpoints.cases.fraudType(caseId), { body, ifMatch: version });
}

/** Müşteri, KAPANDI vakaya bir kez 1–5 yıldız verir (case §4.6). */
export async function submitCaseFeedback(
  caseId: string,
  body: SubmitFeedbackBody,
): Promise<FeedbackResponse> {
  const result = await api.post<FeedbackResponse>(endpoints.cases.feedback(caseId), { body });
  return result.data;
}
