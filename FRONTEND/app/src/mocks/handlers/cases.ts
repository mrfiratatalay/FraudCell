import { http } from 'msw';
import { API_PREFIX } from '@/shared/config/env';
import { endpoints } from '@/shared/api/endpoints';
import { ERROR_CODES } from '@/shared/api/errors';
import type {
  AddNoteBody,
  AssignmentQueueItemResponse,
  FraudTypeOverrideBody,
  FraudTypeOverrideResponse,
  ManualAssignmentBody,
  ManualAssignmentResponse,
  NoteResponse,
  ReassignmentBody,
  ReassignmentResponse,
  RiskLevelOverrideBody,
  RiskLevelOverrideResponse,
  StartReviewResponse,
  SubmitDecisionBody,
  SubmitDecisionResponse,
  SubmitFeedbackBody,
  SubmitVerificationResponseBody,
  SubmitVerificationResponseResult,
  VerificationRequestResponse,
} from '@/shared/api/contract';
import type { PointRuleCode } from '@/shared/api/contract-pending';
import type { RiskLevel } from '@/shared/api/enums';
import { userFromRequest, mockUsers } from '../db';
import {
  casesStore,
  findCase,
  recordTransition,
  toCaseResponse,
  touch,
} from '../seed/cases-seed';
import { awardDecisionPoints } from '../seed/gamification-seed';
import { checkIfMatch, fail, ok, paginate, readLimit, withETag } from '../envelope';

/**
 * Vaka uçlarının mock'u.
 *
 * ⚠️ Bu uçların GERÇEK backend'i VAR (Transaction Service). Şekiller
 * `contract.ts` ile birebir aynı olmalı. 7 mutasyon ucunun 7'si de backend'de
 * `ETagHelper.RequireIfMatch` kullanıyor (StartReview/VerificationRequests/
 * Reassignment dahil — `endpoints.ts`'in yorumları bunu eksik belirtiyordu,
 * gerçek endpoint kaynağına bakılarak doğrulandı), bu yüzden hepsinde
 * `checkIfMatch` çağrılır.
 *
 * Sahibi: B tarafı (Operasyon Konsolu).
 */

const path = (suffix: string) => `${API_PREFIX}${suffix}`;

/** SLA süresi risk seviyesine göre (mock — gerçek eşik backend'de). */
const SLA_MINUTES: Record<RiskLevel, number> = { KRITIK: 15, YUKSEK: 60, ORTA: 240, DUSUK: 1440 };

export const caseHandlers = [
  /* ------------------------------------------------------------- listeler -- */

  http.get(path(endpoints.cases.assigned), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Giriş yapmalısın.');

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = readLimit(url);

    const mine = casesStore
      .filter((c) => c.assignedAnalystId === user.id)
      .filter((c) => !status || c.status === status)
      .sort((a, b) => new Date(a.sla.deadlineAt).getTime() - new Date(b.sla.deadlineAt).getTime());

    const page = paginate(mine.map(toCaseResponse), null, limit);
    return ok(page, { pagination: page.page });
  }),

  http.get(path(endpoints.cases.root), ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const riskLevel = url.searchParams.get('riskLevel');
    const cursor = url.searchParams.get('cursor');
    const limit = readLimit(url);

    const all = [...casesStore]
      .filter((c) => !status || c.status === status)
      .filter((c) => !riskLevel || c.aiRiskLevel === riskLevel || c.overrideRiskLevel === riskLevel)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(toCaseResponse);

    const page = paginate(all, cursor, limit);
    return ok(page, { pagination: page.page });
  }),

  http.get(path(endpoints.cases.assignmentQueue), ({ request }) => {
    const url = new URL(request.url);
    const queueType = url.searchParams.get('queueType') ?? 'QUEUED';
    const limit = readLimit(url);

    const items: AssignmentQueueItemResponse[] = casesStore
      .filter((c) => c.assignmentStatus === queueType)
      .sort((a, b) => new Date(a.sla.deadlineAt).getTime() - new Date(b.sla.deadlineAt).getTime())
      .slice(0, limit)
      .map((c) => {
        const response = toCaseResponse(c);
        return {
          caseId: c.caseId,
          transactionNo: c.transaction.transactionNo,
          assignmentStatus: c.assignmentStatus,
          manualReviewReason: c.manualReviewReason,
          displayRiskLevel: response.effectiveRisk.riskLevel ?? 'BELIRSIZ',
          slaPriority: response.sla.priority,
          slaDeadlineAt: response.sla.deadlineAt,
          createdAt: c.createdAt,
          version: c.version,
        };
      });

    // Backend `hasMore`ı her zaman false döner — kuyrukta "daha fazla yükle" yoktur.
    const page = { nextCursor: null, hasMore: false, limit };
    return ok({ items, page }, { pagination: page });
  }),

  /* --------------------------------------------------------------- detay -- */

  http.get(path(endpoints.cases.byId(':caseId')), ({ params }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');
    return withETag(ok(toCaseResponse(c)), c.version);
  }),

  http.get(path(endpoints.cases.history(':caseId')), ({ params }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');
    return ok([...c.history].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()));
  }),

  http.get(path(endpoints.cases.notes(':caseId')), ({ params }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');
    return ok([...c.notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }),

  http.post(path(endpoints.cases.notes(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const user = userFromRequest(request);
    if (!user) return fail(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Giriş yapmalısın.');

    const body = (await request.json()) as AddNoteBody;
    if (!body.text?.trim()) {
      return fail(400, ERROR_CODES.VALIDATION_FAILED, 'Not boş olamaz.', { field: 'text' });
    }

    const note: NoteResponse = {
      noteId: `note_${crypto.randomUUID().slice(0, 8)}`,
      caseId: c.caseId,
      authorId: user.id,
      text: body.text,
      createdAt: new Date().toISOString(),
    };
    c.notes.push(note);

    return ok(note);
  }),

  /* --------------------------------------------------------- incelemeye al -- */

  http.post(path(endpoints.cases.review(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const conflict = checkIfMatch(request, c.version);
    if (conflict) return conflict;

    if (c.status !== 'ATANDI') {
      return fail(422, ERROR_CODES.INVALID_CASE_TRANSITION, 'Vaka bu durumdayken incelemeye alınamaz.', {
        currentState: c.status,
      });
    }

    const user = userFromRequest(request);
    const previousStatus = c.status;
    c.status = 'INCELENIYOR';
    touch(c);
    recordTransition(c, previousStatus, c.status, user?.id ?? null, 'ANALYST', 'ANALYST', null);

    const response: StartReviewResponse = {
      caseId: c.caseId,
      previousStatus,
      status: c.status,
      reviewStartedAt: c.updatedAt,
      version: c.version,
    };
    return withETag(ok(response), c.version);
  }),

  /* ------------------------------------------------------- doğrulama iste -- */

  http.post(path(endpoints.cases.verificationRequests(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const conflict = checkIfMatch(request, c.version);
    if (conflict) return conflict;

    if (c.status !== 'INCELENIYOR') {
      return fail(422, ERROR_CODES.INVALID_CASE_TRANSITION, 'Vaka bu durumdayken doğrulama istenemez.', {
        currentState: c.status,
      });
    }
    if (c.verification?.status === 'PENDING') {
      return fail(
        409,
        ERROR_CODES.CUSTOMER_VERIFICATION_ALREADY_PENDING,
        'Bu vaka için bekleyen bir müşteri doğrulaması var.',
      );
    }

    await request.json().catch(() => null); // RequestVerificationBody — mock'ta yalnızca doğrulanır, saklanmaz.
    const previousStatus = c.status;
    const user = userFromRequest(request);
    const now = new Date().toISOString();

    c.verification = {
      verificationId: `ver_${crypto.randomUUID().slice(0, 8)}`,
      requestedAt: now,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      status: 'PENDING',
    };
    c.status = 'MUSTERI_DOGRULAMA';
    touch(c);
    recordTransition(c, previousStatus, c.status, user?.id ?? null, 'ANALYST', 'ANALYST', null);

    const response: VerificationRequestResponse = {
      verificationId: c.verification.verificationId,
      caseId: c.caseId,
      status: c.verification.status,
      requestedAt: c.verification.requestedAt,
      expiresAt: c.verification.expiresAt,
      caseStatus: c.status,
      version: c.version,
    };
    return withETag(ok(response), c.version);
  }),

  /** Müşteri yanıtı — If-Match GEREKMEZ (backend doğrulandı). */
  http.post(path(endpoints.cases.verificationResponses(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const body = (await request.json()) as SubmitVerificationResponseBody;
    if (!c.verification || c.verification.verificationId !== body.verificationId || c.verification.status !== 'PENDING') {
      return fail(409, ERROR_CODES.VERIFICATION_NOT_PENDING, 'Bu doğrulama isteği artık yanıtlanamaz.');
    }

    c.verification.status = 'ANSWERED';
    const previousStatus = c.status;
    c.status = 'INCELENIYOR';

    if (body.response === 'NOT_MINE') {
      c.riskScore = Math.max(c.riskScore ?? 0, 0.91);
      c.transaction = { ...c.transaction, controlStatus: 'TEMPORARILY_BLOCKED' };
    }

    touch(c);
    recordTransition(c, previousStatus, c.status, null, 'CUSTOMER', 'CUSTOMER', null);

    const response: SubmitVerificationResponseResult = {
      verificationId: body.verificationId,
      caseId: c.caseId,
      response: body.response,
      respondedAt: new Date().toISOString(),
      caseStatus: c.status,
      transactionControlStatus: c.transaction.controlStatus,
    };
    return ok(response);
  }),

  /* ------------------------------------------------------------- karar ver -- */

  http.patch(path(endpoints.cases.decision(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const conflict = checkIfMatch(request, c.version);
    if (conflict) return conflict;

    if (c.status === 'ONAYLANDI' || c.status === 'BLOKLANDI') {
      return fail(422, ERROR_CODES.CASE_ALREADY_DECIDED, 'Bu vaka için karar zaten verilmiş.');
    }
    if (c.status === 'KAPANDI') {
      return fail(422, ERROR_CODES.CASE_ALREADY_CLOSED, 'Bu vaka kapanmış.');
    }
    if (c.status !== 'INCELENIYOR') {
      return fail(422, ERROR_CODES.INVALID_CASE_TRANSITION, 'Vaka bu durumdayken karar verilemez.', {
        currentState: c.status,
      });
    }

    const body = (await request.json()) as SubmitDecisionBody;
    if (body.decision === 'BLOCK' && !body.note?.trim()) {
      return fail(422, ERROR_CODES.DECISION_NOTE_REQUIRED, 'Karar için not girmen gerekiyor.', {
        field: 'note',
      });
    }

    const user = userFromRequest(request);
    const previousStatus = c.status;
    const deadline = new Date(c.sla.deadlineAt).getTime();
    const now = Date.now();
    const compliant = now <= deadline;

    c.status = body.decision === 'APPROVE' ? 'ONAYLANDI' : 'BLOKLANDI';
    c.finalDecision = body.decision;
    c.decisionNote = body.note ?? null;
    c.transaction = {
      ...c.transaction,
      controlStatus: body.decision === 'APPROVE' ? 'APPROVED' : 'BLOCKED',
    };
    c.sla = { ...c.sla, stoppedAt: new Date().toISOString() };
    touch(c);
    recordTransition(c, previousStatus, c.status, user?.id ?? null, 'ANALYST', 'ANALYST', body.overrideReason ?? null);

    // Puan hesabı burada YAPILMAZ demek yerine (gerçek backend bunu SSE ile
    // ayrıca gönderir), mock'ta doğrudan uygularız — mock modda SSE hiç
    // bağlanmadığı için (useRealtime.ts) aksi hâlde gamification hiç güncellenmez.
    if (user) {
      const effectiveFraudType = c.overrideFraudType ?? c.aiFraudType;
      const confirmedFraud = body.decision === 'BLOCK' && effectiveFraudType !== 'TEMIZ';
      const criticalWithinSla = c.sla.priority === 'KRITIK' && compliant;

      const entries: { ruleCode: PointRuleCode; points: number }[] = [{ ruleCode: 'CASE_DECISION', points: 10 }];
      if (compliant) entries.push({ ruleCode: 'FAST_DECISION', points: 5 });
      if (confirmedFraud) entries.push({ ruleCode: 'CONFIRMED_FRAUD', points: 15 });
      if (criticalWithinSla) entries.push({ ruleCode: 'CRITICAL_WITHIN_SLA', points: 15 });
      if (!compliant) entries.push({ ruleCode: 'SLA_BREACH', points: -10 });

      awardDecisionPoints(user.id, c.caseId, c.transaction.transactionNo, entries, compliant);
    }

    const response: SubmitDecisionResponse = {
      caseId: c.caseId,
      previousStatus,
      status: c.status,
      decision: body.decision,
      decisionNote: c.decisionNote,
      decidedBy: user?.id ?? 'unknown',
      decidedAt: c.updatedAt,
      transactionControlStatus: c.transaction.controlStatus,
      sla: { deadlineAt: c.sla.deadlineAt, stoppedAt: c.sla.stoppedAt, compliant },
      closureDueAt:
        body.decision === 'BLOCK' ? new Date(Date.now() + 48 * 3600_000).toISOString() : null,
      version: c.version,
    };
    return withETag(ok(response), c.version);
  }),

  /* ---------------------------------------------------------- manuel atama -- */

  http.put(path(endpoints.cases.assignment(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const conflict = checkIfMatch(request, c.version);
    if (conflict) return conflict;

    const body = (await request.json()) as ManualAssignmentBody;
    const analyst = mockUsers.find((u) => u.id === body.analystId && u.role === 'ANALYST');
    if (!analyst) {
      return fail(400, ERROR_CODES.VALIDATION_FAILED, 'Seçilen analist bulunamadı.', {
        field: 'analystId',
      });
    }

    const previousStatus = c.status;
    c.assignedAnalystId = analyst.id;
    c.assignmentStatus = 'ASSIGNED';
    if (c.status === 'YENI') c.status = 'ATANDI';
    touch(c);

    const user = userFromRequest(request);
    recordTransition(c, previousStatus, c.status, user?.id ?? null, 'SUPERVISOR', 'SUPERVISOR', body.reason);

    const response: ManualAssignmentResponse = {
      caseId: c.caseId,
      assignedAnalystId: analyst.id,
      assignmentStatus: c.assignmentStatus,
      caseStatus: c.status,
      assignedAt: c.updatedAt,
      assignmentSource: 'SUPERVISOR',
      version: c.version,
    };
    return withETag(ok(response), c.version);
  }),

  http.post(path(endpoints.cases.reassignments(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const conflict = checkIfMatch(request, c.version);
    if (conflict) return conflict;

    const body = (await request.json()) as ReassignmentBody;
    const analyst = mockUsers.find((u) => u.id === body.newAnalystId && u.role === 'ANALYST');
    if (!analyst) {
      return fail(400, ERROR_CODES.VALIDATION_FAILED, 'Seçilen analist bulunamadı.', {
        field: 'newAnalystId',
      });
    }

    const previousAnalystId = c.assignedAnalystId;
    c.assignedAnalystId = analyst.id;
    touch(c);

    const user = userFromRequest(request);
    recordTransition(c, c.status, c.status, user?.id ?? null, 'SUPERVISOR', 'SUPERVISOR', body.reason);

    const response: ReassignmentResponse = {
      caseId: c.caseId,
      previousAnalystId,
      assignedAnalystId: analyst.id,
      reassignedAt: c.updatedAt,
      caseStatus: c.status,
      version: c.version,
    };
    return withETag(ok(response), c.version);
  }),

  /* ------------------------------------------------------------ override'lar -- */

  http.patch(path(endpoints.cases.fraudType(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const conflict = checkIfMatch(request, c.version);
    if (conflict) return conflict;

    const body = (await request.json()) as FraudTypeOverrideBody;
    const previousEffectiveFraudType = c.overrideFraudType ?? c.aiFraudType ?? 'TEMIZ';
    c.overrideFraudType = body.fraudType;
    touch(c);

    const user = userFromRequest(request);
    recordTransition(c, c.status, c.status, user?.id ?? null, 'SUPERVISOR', 'SUPERVISOR', body.reason);

    const response: FraudTypeOverrideResponse = {
      caseId: c.caseId,
      aiFraudType: c.aiFraudType,
      previousEffectiveFraudType,
      effectiveFraudType: body.fraudType,
      overriddenBy: user?.id ?? 'unknown',
      overriddenAt: c.updatedAt,
      version: c.version,
    };
    return withETag(ok(response), c.version);
  }),

  http.patch(path(endpoints.cases.riskLevel(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    const conflict = checkIfMatch(request, c.version);
    if (conflict) return conflict;

    if (c.status === 'ONAYLANDI' || c.status === 'BLOKLANDI' || c.status === 'KAPANDI') {
      return fail(422, ERROR_CODES.INVALID_CASE_TRANSITION, 'Karar verilmiş bir vakanın risk seviyesi değiştirilemez.');
    }

    const body = (await request.json()) as RiskLevelOverrideBody;
    const previousRiskLevel = c.overrideRiskLevel ?? c.aiRiskLevel ?? 'ORTA';
    c.overrideRiskLevel = body.riskLevel;

    // Risk değişince SLA yeniden başlar — backend'in yaptığı gibi (doküman §10).
    const startedAt = new Date().toISOString();
    const deadlineAt = new Date(Date.now() + SLA_MINUTES[body.riskLevel] * 60_000).toISOString();
    c.sla = { priority: body.riskLevel, startedAt, deadlineAt, breachedAt: null, stoppedAt: null };
    touch(c);

    const user = userFromRequest(request);
    recordTransition(c, c.status, c.status, user?.id ?? null, 'SUPERVISOR', 'SUPERVISOR', body.reason);

    const response: RiskLevelOverrideResponse = {
      caseId: c.caseId,
      previousRiskLevel,
      effectiveRiskLevel: body.riskLevel,
      sla: { priority: body.riskLevel, startedAt, deadlineAt, breachedAt: null },
      transactionControlStatus: c.transaction.controlStatus,
      version: c.version,
    };
    return withETag(ok(response), c.version);
  }),

  /* --------------------------------------------------------------- feedback -- */

  http.post(path(endpoints.cases.feedback(':caseId')), async ({ params, request }) => {
    const c = findCase(params.caseId as string);
    if (!c) return fail(404, ERROR_CODES.CASE_NOT_FOUND, 'Vaka bulunamadı.');

    if (!c.finalDecision) {
      return fail(422, ERROR_CODES.FEEDBACK_NOT_ALLOWED, 'Bu vaka için geri bildirim verilemez.');
    }
    if (c.feedbackSubmitted) {
      return fail(409, ERROR_CODES.FEEDBACK_ALREADY_SUBMITTED, 'Bu vaka için geri bildirimini zaten verdin.');
    }

    const body = (await request.json()) as SubmitFeedbackBody;
    c.feedbackSubmitted = true;

    return ok({
      feedbackId: `fb_${crypto.randomUUID().slice(0, 8)}`,
      caseId: c.caseId,
      rating: body.rating,
      comment: body.comment ?? null,
      submittedAt: new Date().toISOString(),
    });
  }),
];
