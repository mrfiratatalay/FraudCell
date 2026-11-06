/** Demo versions of transactions, cases, gamification and AI read endpoints. */
import { http } from 'msw';
import { endpoints } from '@/shared/api/endpoints';
import type { CreateTransactionBody, FraudTypeOverrideBody, ManualAssignmentBody, ReassignmentBody, RiskLevelOverrideBody, SubmitDecisionBody, SubmitFeedbackBody } from '@/shared/api/contract';
import { FRAUD_TYPE_LABEL, RISK_LEVEL_LABEL, SCREENING_DECISION_LABEL, type FraudType, type RiskLevel } from '@/shared/api/enums';
import { checkIfMatch, fail, ok, paginate, readLimit, withETag } from './envelope';
import { audit, p, requireRole } from './identity-handlers';
import { caseResponse, historyResponse, leaderboard, performance, profile, txDetail, txListItem } from './mappers';
import { addTransaction, answer, db, decide, decisionOf, newId, openCase, REASON, riskLevelOf, save, transition, type DemoCase } from './store';

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
const findCase = (id: unknown) => db().cases.find((c) => c.id === id);
const caseOk = (c: DemoCase) => withETag(ok(caseResponse(c)), c.version);

/** Riskiest and most urgent first, like the real list endpoints. */
function urgency(a: DemoCase, b: DemoCase) {
  const ra = caseResponse(a);
  const rb = caseResponse(b);
  const breached = Number(Boolean(rb.sla.breachedAt && !rb.sla.stoppedAt)) - Number(Boolean(ra.sla.breachedAt && !ra.sla.stoppedAt));
  return breached || (rb.effectiveRisk.riskScore ?? 0) - (ra.effectiveRisk.riskScore ?? 0);
}

/** Small stand-in for the model: amount spike, foreign location, night time, new recipient. */
function score(body: CreateTransactionBody, customerId: string) {
  const past = db().transactions.filter((t) => t.customerId === customerId);
  const avg = past.length ? past.reduce((s, t) => s + t.amount, 0) / past.length : 1_500;
  const ratio = body.amount / avg;
  const hour = new Date(body.occurredAt).getHours();
  const reasons = [];
  let s = 0.08;
  if (ratio >= 2) { s += Math.min(0.4, 0.05 * ratio); reasons.push(REASON.amount(Math.round(ratio * 10) / 10)); }
  if (body.location.countryCode.toUpperCase() !== 'TR') { s += 0.28; reasons.push(REASON.UNUSUAL_LOCATION); }
  if (hour < 6) { s += 0.12; reasons.push(REASON.NIGHT); }
  if (!past.some((t) => t.recipient === body.recipient.reference)) { s += 0.06; reasons.push(REASON.NEW_RECIPIENT); }
  s = Math.min(0.97, Math.max(0.03, s));
  const fraudType: FraudType = s < 0.4 ? 'TEMIZ' : body.location.countryCode.toUpperCase() !== 'TR' ? 'CALINTI_KART' : ratio >= 8 ? 'PARA_AKLAMA' : 'HESAP_ELE_GECIRME';
  return { s, fraudType, reasons };
}

function autoAssign(c: DemoCase) {
  const candidates = db().users.filter((u) => u.role === 'ANALYST' && u.isActive && u.assignmentEnabled && c.fraudType && u.specialties.includes(c.fraudType as never));
  const load = (id: string) => db().cases.filter((x) => x.analystId === id && !x.decidedAt).length;
  const pick = candidates.sort((a, b) => load(a.id) - load(b.id))[0];
  if (!pick) return;
  c.analystId = pick.id;
  c.queue = 'ASSIGNED';
  transition(c, 'ATANDI', null, null, 'SYSTEM', 'Uzmanlık ve bölgeye göre otomatik atama');
}

export const caseHandlers = [
  /* ------------------------------------------------------- transactions -- */
  http.get(p(endpoints.transactions.root), ({ request }) => {
    const user = requireRole(request);
    if (user instanceof Response) return user;
    const url = new URL(request.url);
    const level = url.searchParams.get('riskLevel');
    const rows = db().transactions
      .filter((t) => user.role !== 'CUSTOMER' || t.customerId === user.id)
      .filter((t) => !level || riskLevelOf(t.score) === level)
      .sort(byNewest)
      .map(txListItem);
    return ok(paginate(rows, url.searchParams.get('cursor'), readLimit(url, 20)));
  }),

  http.get(p(endpoints.transactions.byId(':id')), ({ request, params }) => {
    const user = requireRole(request);
    if (user instanceof Response) return user;
    const tx = db().transactions.find((t) => t.id === params.id);
    if (!tx || (user.role === 'CUSTOMER' && tx.customerId !== user.id)) return fail(404, 'NOT_FOUND', 'İşlem bulunamadı.');
    return ok(txDetail(tx));
  }),

  http.post(p(endpoints.transactions.root), async ({ request }) => {
    const user = requireRole(request, 'CUSTOMER');
    if (user instanceof Response) return user;
    const body = (await request.json()) as CreateTransactionBody;
    const { s, fraudType, reasons } = score(body, user.id);
    const tx = addTransaction(db(), { customerId: user.id, amount: body.amount, type: body.transactionType, city: body.location.city, country: body.location.countryCode.toUpperCase(), at: Date.now(), score: s, fraudType, reasons, recipient: body.recipient.reference });
    if (decisionOf(s) !== 'ONAY') autoAssign(openCase(db(), tx, Date.now(), riskLevelOf(s)));
    save();
    const level = riskLevelOf(s);
    return ok({ transactionId: tx.id, transactionNo: tx.no, amount: tx.amount, currency: 'TRY', transactionType: tx.type, assessmentStatus: 'COMPLETED', riskScore: tx.score, riskLevel: level, displayRiskLevel: level, screeningDecision: decisionOf(s), controlStatus: tx.controlStatus, temporaryBlocked: tx.controlStatus === 'TEMPORARILY_BLOCKED', createdAt: tx.createdAt });
  }),

  http.get(p(endpoints.customer.pendingVerifications), ({ request }) => {
    const user = requireRole(request, 'CUSTOMER');
    if (user instanceof Response) return user;
    const rows = db().cases
      .filter((c) => c.status === 'MUSTERI_DOGRULAMA' && c.verification && !c.verification.answer)
      .map((c) => ({ c, tx: db().transactions.find((t) => t.id === c.transactionId)! }))
      .filter(({ tx }) => tx.customerId === user.id)
      .map(({ c, tx }) => ({
        verificationId: c.verification!.id, caseId: c.id, transactionId: tx.id, transactionNo: tx.no, amount: tx.amount, currency: 'TRY',
        transactionType: tx.type, city: tx.city, countryCode: tx.country, occurredAt: tx.occurredAt, requestedAt: c.verification!.requestedAt,
        expiresAt: new Date(Date.parse(c.verification!.requestedAt) + 60 * 60_000).toISOString(),
      }));
    return ok(rows);
  }),

  /* -------------------------------------------------------------- cases -- */
  http.get(p(endpoints.cases.assigned), ({ request }) => {
    const user = requireRole(request, 'ANALYST');
    if (user instanceof Response) return user;
    const status = new URL(request.url).searchParams.get('status');
    const rows = db().cases.filter((c) => c.analystId === user.id && (!status || c.status === status)).sort(urgency).map(caseResponse);
    return ok({ items: rows, page: { nextCursor: null, hasMore: false, limit: 50 } });
  }),

  http.get(p(endpoints.cases.assignmentQueue), ({ request }) => {
    const user = requireRole(request, 'SUPERVISOR', 'ADMIN');
    if (user instanceof Response) return user;
    const type = new URL(request.url).searchParams.get('queueType') ?? 'ALL';
    const rows = db().cases
      .filter((c) => !c.analystId && !c.decidedAt && (type === 'ALL' || c.queue === type))
      .map((c) => {
        const r = caseResponse(c);
        return { caseId: c.id, transactionNo: r.transaction.transactionNo, assignmentStatus: r.assignmentStatus, manualReviewReason: c.manualReason, displayRiskLevel: c.riskLevel ?? 'BELIRSIZ', slaPriority: r.sla.priority, slaDeadlineAt: r.sla.deadlineAt, createdAt: c.createdAt, version: c.version };
      });
    return ok({ items: rows, page: { nextCursor: null, hasMore: false, limit: 100 } });
  }),

  http.get(p(endpoints.cases.root), ({ request }) => {
    const user = requireRole(request, 'SUPERVISOR', 'ADMIN');
    if (user instanceof Response) return user;
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const level = url.searchParams.get('riskLevel');
    const rows = db().cases.filter((c) => (!status || c.status === status) && (!level || c.riskLevel === level)).sort(urgency).map(caseResponse);
    return ok(paginate(rows, url.searchParams.get('cursor'), readLimit(url, 30)));
  }),

  http.get(p(endpoints.cases.byId(':id')), ({ request, params }) => {
    const user = requireRole(request, 'ANALYST', 'SUPERVISOR', 'ADMIN');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    if (!c || (user.role === 'ANALYST' && c.analystId !== user.id)) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
    return caseOk(c);
  }),

  http.get(p(endpoints.cases.history(':id')), ({ params }) => {
    const c = findCase(params.id);
    return c ? ok(historyResponse(c)) : fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
  }),

  http.post(p(endpoints.cases.review(':id')), ({ request, params }) => {
    const user = requireRole(request, 'ANALYST');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    if (!c || c.analystId !== user.id) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
    const bad = checkIfMatch(request, c.version);
    if (bad) return bad;
    if (c.status !== 'ATANDI') return fail(409, 'INVALID_CASE_TRANSITION', 'İnceleme yalnızca atanmış vakada başlatılabilir.');
    transition(c, 'INCELENIYOR', user.id, 'ANALYST', 'ANALYST', null);
    save();
    return withETag(ok({ caseId: c.id, previousStatus: 'ATANDI', status: c.status, reviewStartedAt: new Date().toISOString(), version: c.version }), c.version);
  }),

  http.post(p(endpoints.cases.verificationRequests(':id')), ({ request, params }) => {
    const user = requireRole(request, 'ANALYST');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    if (!c || c.analystId !== user.id) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
    const bad = checkIfMatch(request, c.version);
    if (bad) return bad;
    if (c.status !== 'INCELENIYOR') return fail(409, 'INVALID_CASE_TRANSITION', 'Doğrulama yalnızca incelenen vakada istenebilir.');
    transition(c, 'MUSTERI_DOGRULAMA', user.id, 'ANALYST', 'ANALYST', null);
    c.verification = { id: newId('ver'), requestedAt: new Date().toISOString(), answer: null, answeredAt: null };
    save();
    return withETag(ok({ verificationId: c.verification.id, caseId: c.id, status: 'PENDING', requestedAt: c.verification.requestedAt, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), caseStatus: c.status, version: c.version }), c.version);
  }),

  http.post(p(endpoints.cases.verificationResponses(':id')), async ({ request, params }) => {
    const user = requireRole(request, 'CUSTOMER');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    const body = (await request.json()) as { verificationId: string; response: 'MINE' | 'NOT_MINE' };
    if (!c?.verification || c.verification.id !== body.verificationId || c.verification.answer) return fail(409, 'VERIFICATION_NOT_PENDING', 'Bu doğrulama zaten cevaplanmış.');
    answer(db(), c, body.response);
    save();
    const tx = db().transactions.find((t) => t.id === c.transactionId)!;
    return ok({ verificationId: body.verificationId, caseId: c.id, response: body.response, respondedAt: c.verification.answeredAt, caseStatus: c.status, transactionControlStatus: tx.controlStatus });
  }),

  http.patch(p(endpoints.cases.decision(':id')), async ({ request, params }) => {
    const user = requireRole(request, 'ANALYST');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    if (!c || c.analystId !== user.id) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
    const bad = checkIfMatch(request, c.version);
    if (bad) return bad;
    const body = (await request.json()) as SubmitDecisionBody;
    if (c.status !== 'INCELENIYOR') return fail(409, 'INVALID_CASE_TRANSITION', 'Karar yalnızca incelenen vakada verilebilir.');
    if (body.decision === 'BLOCK' && !body.note?.trim()) return fail(400, 'VALIDATION_FAILED', 'Blok kararında not zorunludur.');
    decide(db(), c, body.decision, user.id, body.note?.trim() || null);
    audit(user, 'CASE_DECIDED', 'case', c.id, 'transaction-service');
    save();
    return caseOk(c);
  }),

  http.put(p(endpoints.cases.assignment(':id')), async ({ request, params }) => assign(request, String(params.id), false)),
  http.post(p(endpoints.cases.reassignments(':id')), async ({ request, params }) => assign(request, String(params.id), true)),

  http.patch(p(endpoints.cases.riskLevel(':id')), async ({ request, params }) => {
    const user = requireRole(request, 'SUPERVISOR');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    if (!c) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
    const bad = checkIfMatch(request, c.version);
    if (bad) return bad;
    const body = (await request.json()) as RiskLevelOverrideBody;
    c.riskLevel = body.riskLevel as RiskLevel;
    c.overridden = true;
    c.version += 1;
    audit(user, 'RISK_LEVEL_OVERRIDDEN', 'case', c.id, 'transaction-service');
    save();
    return caseOk(c);
  }),

  http.patch(p(endpoints.cases.fraudType(':id')), async ({ request, params }) => {
    const user = requireRole(request, 'SUPERVISOR');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    if (!c) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
    const bad = checkIfMatch(request, c.version);
    if (bad) return bad;
    const body = (await request.json()) as FraudTypeOverrideBody;
    c.fraudType = body.fraudType;
    c.overridden = true;
    if (c.queue === 'MANUAL_QUEUE') c.queue = 'QUEUED';
    c.version += 1;
    audit(user, 'FRAUD_TYPE_OVERRIDDEN', 'case', c.id, 'transaction-service');
    save();
    return caseOk(c);
  }),

  http.post(p(endpoints.cases.feedback(':id')), async ({ request, params }) => {
    const user = requireRole(request, 'CUSTOMER');
    if (user instanceof Response) return user;
    const c = findCase(params.id);
    const tx = c && db().transactions.find((t) => t.id === c.transactionId);
    if (!c || !tx || tx.customerId !== user.id) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
    if (c.status !== 'KAPANDI') return fail(409, 'CASE_NOT_CLOSED', 'Geri bildirim yalnızca kapanan vakaya verilebilir.');
    if (tx.rating) return fail(409, 'FEEDBACK_ALREADY_SUBMITTED', 'Bu vaka için zaten geri bildirim verilmiş.');
    const body = (await request.json()) as SubmitFeedbackBody;
    tx.rating = body.rating;
    save();
    return ok({ feedbackId: newId('fb'), caseId: c.id, rating: body.rating, comment: body.comment ?? null, submittedAt: new Date().toISOString() });
  }),

  http.post(p(endpoints.realtime.tickets), () => ok({ ticket: 'demo', expiresAt: new Date(Date.now() + 30_000).toISOString() })),

  /* ------------------------------------------------------- gamification -- */
  http.get(p(endpoints.gamification.myProfile), ({ request }) => {
    const user = requireRole(request, 'ANALYST');
    return user instanceof Response ? user : ok(profile(user.id));
  }),
  http.get(p(endpoints.gamification.points(':id')), ({ params }) =>
    ok(db().ledger.filter((l) => l.analystId === params.id).sort((a, b) => b.at.localeCompare(a.at)).map((l) => ({ ledgerId: l.id, caseId: l.caseId, ruleCode: l.rule, points: l.points, description: l.description, occurredAt: l.at }))),
  ),
  http.get(p(endpoints.gamification.performance(':id')), ({ params }) => ok(performance(String(params.id)))),
  http.get(p(endpoints.gamification.leaderboard), ({ request }) => {
    const period = new URL(request.url).searchParams.get('period') === 'weekly' ? 'weekly' : 'daily';
    const board = leaderboard(period);
    return ok({ period, periodStart: new Date(board.start).toISOString(), periodEnd: new Date(board.end).toISOString(), items: board.items.slice(0, 10) });
  }),

  /* ----------------------------------------------------------------- AI -- */
  http.get(p(endpoints.ai.explanationByTransaction(':id')), ({ params }) => {
    const tx = db().transactions.find((t) => t.id === params.id);
    if (!tx) return fail(404, 'NOT_FOUND', 'Bu işlem için tahmin bulunamadı.');
    const level = riskLevelOf(tx.score);
    const signals = tx.reasons.map((r) => r.label).join(', ');
    const text = `Risk seviyesi ${RISK_LEVEL_LABEL[level].toLocaleUpperCase('tr-TR')} (${FRAUD_TYPE_LABEL[tx.fraudType]}), karar ${SCREENING_DECISION_LABEL[decisionOf(tx.score)].toLocaleUpperCase('tr-TR')}. ` + (signals ? `Öne çıkan sinyaller: ${signals}.` : 'Belirgin bir risk sinyali tespit edilmedi.');
    return ok({ assessmentId: `asm-${tx.id}`, explanation: text, source: 'deterministic', generatedAt: null });
  }),
  http.get(p(endpoints.ai.metrics.overview), () => ok(aiMetrics().overview)),
  http.get(p(endpoints.ai.metrics.decisionAgreement), () => ok({ sampleCount: aiMetrics().overview.sampleCount, decisionAgreementRate: aiMetrics().overview.decisionAgreementRate })),
  http.get(p(endpoints.ai.metrics.categories), () => ok({ items: aiMetrics().categories })),
];

async function assign(request: Request, caseId: string, reassign: boolean) {
  const user = requireRole(request, 'SUPERVISOR');
  if (user instanceof Response) return user;
  const c = findCase(caseId);
  if (!c) return fail(404, 'NOT_FOUND', 'Vaka bulunamadı.');
  const bad = checkIfMatch(request, c.version);
  if (bad) return bad;
  const body = (await request.json()) as ManualAssignmentBody & ReassignmentBody;
  const analystId = reassign ? body.newAnalystId : body.analystId;
  const analyst = db().users.find((u) => u.id === analystId);
  if (!analyst?.isActive || !analyst.assignmentEnabled) return fail(409, 'ANALYST_NOT_ASSIGNABLE', 'Analist pasif ya da atamaya kapalı.');
  c.analystId = analyst.id;
  c.queue = 'ASSIGNED';
  if (c.status === 'YENI') transition(c, 'ATANDI', user.id, 'SUPERVISOR', 'SUPERVISOR', body.reason);
  else c.version += 1;
  audit(user, reassign ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED', 'case', c.id, 'transaction-service');
  save();
  return caseOk(c);
}

/** Model metrics computed from the demo's own decided cases, never typed in. */
function aiMetrics() {
  const decided = db().cases.filter((c) => c.decidedAt);
  const tx = (c: DemoCase) => db().transactions.find((t) => t.id === c.transactionId)!;
  const agree = decided.filter((c) => (tx(c).score >= 0.7) === (c.decision === 'BLOCK')).length;
  const blocks = decided.filter((c) => c.decision === 'BLOCK');
  const falsePos = blocks.filter((c) => c.verification?.answer === 'MINE').length;
  const typed = decided.filter((c) => c.fraudType);
  const types = [...new Set(typed.map((c) => c.fraudType!))];
  return {
    overview: {
      sampleCount: decided.length,
      fraudTypeAccuracy: typed.length ? typed.filter((c) => !c.overridden).length / typed.length : null,
      decisionAgreementRate: decided.length ? agree / decided.length : null,
      falsePositiveRate: blocks.length ? falsePos / blocks.length : null,
      totalPredictions: db().transactions.length,
      modelBundleVersion: 'fraudcell-ai-1.0.0',
      calculatedAt: new Date().toISOString(),
    },
    categories: types.map((t) => {
      const rows = typed.filter((c) => c.fraudType === t);
      const b = rows.filter((c) => c.decision === 'BLOCK');
      const confirmed = b.filter((c) => c.verification?.answer === 'NOT_MINE').length;
      const missed = rows.filter((c) => c.decision === 'APPROVE' && c.verification?.answer === 'NOT_MINE').length;
      return { fraudType: t, sampleCount: rows.length, accuracy: rows.filter((c) => !c.overridden).length / rows.length, precision: b.length ? confirmed / b.length : null, recall: confirmed + missed ? confirmed / (confirmed + missed) : null };
    }),
  };
}
