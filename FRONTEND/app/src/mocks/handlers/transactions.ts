import { http } from 'msw';
import { API_PREFIX } from '@/shared/config/env';
import { endpoints, pendingEndpoints } from '@/shared/api/endpoints';
import type {
  CreateTransactionBody,
  CreateTransactionResponse,
  PendingVerificationResponse,
  SubmitFeedbackBody,
  SubmitVerificationResponseBody,
  TransactionListItemResponse,
} from '@/shared/api/contract';
import type { AppNotification } from '@/shared/api/contract-pending';
import { userFromRequest } from '../db';
import { created, fail, ok, paginate, readLimit } from '../envelope';
import {
  applyAssessment,
  createFrom,
  notifications,
  persist,
  pushNotification,
  seedTransactions,
  toDetail,
  transactions,
  verifications,
} from '../transactionStore';

/**
 * İşlem, doğrulama, geri bildirim ve bildirim uçlarının mock'u.
 *
 * İşlem ve doğrulama uçlarının GERÇEK backend'i var (Transaction Service);
 * bildirim ucunun yoktur ve `pendingEndpoints` altındadır.
 *
 * Sahibi: A tarafı.
 */

const path = (suffix: string) => `${API_PREFIX}${suffix}`;

/** Değerlendirmenin asenkronluğunu görünür kılacak kadar gecikme. */
const ASSESSMENT_DELAY_MS = 2500;

export const transactionHandlers = [
  /* ------------------------------------------------------- liste (GET) -- */
  http.get(path(endpoints.transactions.root), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');

    seedTransactions(user.id);

    const url = new URL(request.url);
    const assessmentStatus = url.searchParams.get('assessmentStatus');
    const riskLevel = url.searchParams.get('riskLevel');

    let rows = transactions.filter((t) =>
      user.role === 'CUSTOMER' ? t.customerId === user.id : true,
    );
    if (assessmentStatus) rows = rows.filter((t) => t.assessmentStatus === assessmentStatus);
    if (riskLevel) rows = rows.filter((t) => t.riskLevel === riskLevel);

    rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const items: TransactionListItemResponse[] = rows.map((t) => ({
      transactionId: t.id,
      transactionNo: t.transactionNo,
      amount: t.amount,
      currency: t.currency,
      transactionType: t.transactionType,
      assessmentStatus: t.assessmentStatus,
      // Backend değerlendirme bitmediğinde "BELIRSIZ" yazar.
      displayRiskLevel: t.riskLevel ?? 'BELIRSIZ',
      screeningDecision: t.screeningDecision ?? 'INCELEME',
      controlStatus: t.controlStatus,
      createdAt: t.createdAt,
    }));

    const page = paginate(items, url.searchParams.get('cursor'), readLimit(url));
    return ok(page, { pagination: page.page });
  }),

  /* -------------------------------------------------------- detay (GET) -- */
  http.get(path('/transactions/:transactionId'), ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');

    const tx = transactions.find((t) => t.id === params['transactionId']);
    if (!tx) return fail(404, 'TRANSACTION_NOT_FOUND', 'İşlem bulunamadı.');

    // Sahiplik kontrolü: müşteri yalnızca kendi işlemini görebilir.
    if (user.role === 'CUSTOMER' && tx.customerId !== user.id) {
      return fail(403, 'CUSTOMER_NOT_OWNER', 'Bu işleme erişim yetkin yok.');
    }

    return ok(toDetail(tx));
  }),

  /* ------------------------------------------------------ oluştur (POST) -- */
  http.post(path(endpoints.transactions.root), async ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');
    if (user.role !== 'CUSTOMER') {
      return fail(403, 'ROLE_NOT_ALLOWED', 'Yalnızca müşteri işlem oluşturabilir.');
    }

    // Backend'de zorunlu; mock'ta da zorunlu tutuyoruz ki eksikliği
    // geliştirme sırasında fark edilsin.
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return fail(400, 'IDEMPOTENCY_KEY_REQUIRED', "Idempotency-Key header'ı zorunludur.");
    }

    const body = (await request.json()) as CreateTransactionBody;

    if (!(body.amount > 0)) {
      return fail(400, 'INVALID_TRANSACTION_AMOUNT', 'Tutar sıfırdan büyük olmalıdır.', {
        field: 'amount',
      });
    }

    const tx = createFrom(body, user.id);
    transactions.push(tx);
    persist();

    // Değerlendirme ASENKRON: yanıt PENDING döner, sonuç sonra gelir.
    // Ekranın "değerlendiriliyor" durumunu göstermesi bu gecikmeye bağlı.
    setTimeout(() => applyAssessment(tx, body), ASSESSMENT_DELAY_MS);

    const response: CreateTransactionResponse = {
      transactionId: tx.id,
      transactionNo: tx.transactionNo,
      amount: tx.amount,
      currency: tx.currency,
      transactionType: tx.transactionType,
      assessmentStatus: 'PENDING',
      riskScore: null,
      riskLevel: null,
      displayRiskLevel: 'BELIRSIZ',
      screeningDecision: 'INCELEME',
      controlStatus: 'ALLOWED',
      temporaryBlocked: false,
      createdAt: tx.createdAt,
    };

    return created(response, `/api/v1/transactions/${tx.id}`);
  }),

  /* ------------------------------------------- bekleyen doğrulamalar -- */
  http.get(path(endpoints.customer.pendingVerifications), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');

    seedTransactions(user.id);

    const items: PendingVerificationResponse[] = verifications
      .filter((v) => v.status === 'PENDING')
      .flatMap((v) => {
        const tx = transactions.find((t) => t.id === v.transactionId);
        if (!tx || tx.customerId !== user.id) return [];
        return [
          {
            verificationId: v.verificationId,
            caseId: v.caseId,
            transactionId: tx.id,
            transactionNo: tx.transactionNo,
            amount: tx.amount,
            currency: tx.currency,
            transactionType: tx.transactionType,
            city: tx.city,
            countryCode: tx.countryCode,
            occurredAt: tx.occurredAt,
            requestedAt: v.requestedAt,
            expiresAt: v.expiresAt,
          },
        ];
      });

    return ok(items);
  }),

  /* ----------------------------------------------- doğrulama yanıtı -- */
  http.post(path('/cases/:caseId/verification-responses'), async ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');

    const body = (await request.json()) as SubmitVerificationResponseBody;
    const v = verifications.find((x) => x.verificationId === body.verificationId);

    if (!v || v.caseId !== params['caseId']) {
      return fail(404, 'NOT_FOUND', 'Doğrulama isteği bulunamadı.');
    }
    if (v.status !== 'PENDING') {
      return fail(409, 'VERIFICATION_NOT_PENDING', 'Bu doğrulama artık yanıtlanamaz.');
    }

    v.status = 'ANSWERED';

    const tx = transactions.find((t) => t.id === v.transactionId);
    if (tx) {
      if (body.response === 'NOT_MINE') {
        // "Ben yapmadım": işlem geçici bloka alınır ve risk en üste çekilir
        // (doküman §11). Bu yüzden bu işlem optimistic yapılamaz.
        tx.controlStatus = 'TEMPORARILY_BLOCKED';
        tx.riskScore = Math.max(tx.riskScore ?? 0, 0.95);
        tx.riskLevel = 'KRITIK';
        tx.screeningDecision = 'BLOK';
        pushNotification({
          kind: 'SLA_CRITICAL',
          title: 'İşlemin bloklandı',
          body: `${tx.transactionNo} güvenliğin için geçici bloka alındı.`,
          link: `/customer/transactions/${tx.id}`,
        });
      } else {
        pushNotification({
          kind: 'CASE_CLOSED',
          title: 'Doğrulaman alındı',
          body: `${tx.transactionNo} için onayın kaydedildi.`,
          link: `/customer/transactions/${tx.id}`,
        });
      }
      tx.version += 1;
    }

    persist();

    return ok({
      verificationId: v.verificationId,
      caseId: v.caseId,
      response: body.response,
      respondedAt: new Date().toISOString(),
      caseStatus: body.response === 'NOT_MINE' ? 'BLOKLANDI' : 'INCELENIYOR',
      transactionControlStatus: tx?.controlStatus ?? 'ALLOWED',
    });
  }),

  /* ------------------------------------------------------ geri bildirim -- */
  http.post(path('/cases/:caseId/feedback'), async ({ request, params }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');

    const body = (await request.json()) as SubmitFeedbackBody;
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      return fail(400, 'VALIDATION_FAILED', 'Puan 1 ile 5 arasında olmalıdır.', {
        field: 'rating',
      });
    }

    return created({
      feedbackId: crypto.randomUUID(),
      caseId: params['caseId'] as string,
      rating: body.rating,
      comment: body.comment ?? null,
      submittedAt: new Date().toISOString(),
    });
  }),

  /* ---------------------------------------------------------- bildirim -- */
  // ⚠️ Notification Service YAZILMADI; bu uçlar yalnızca mock'ta var.
  http.get(path(pendingEndpoints.notifications.root), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');
    seedTransactions(user.id);
    return ok(notifications as AppNotification[]);
  }),

  http.post(path('/notifications/:id/read'), ({ params }) => {
    const n = notifications.find((x) => x.id === params['id']);
    if (n) n.read = true;
    persist();
    return ok(null);
  }),

  http.post(path(pendingEndpoints.notifications.readAll), () => {
    for (const n of notifications) n.read = true;
    persist();
    return ok(null);
  }),
];
