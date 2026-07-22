import { http } from 'msw';
import { API_PREFIX } from '@/shared/config/env';
import { endpoints } from '@/shared/api/endpoints';
import type {
  CurrentUserResponse,
  RefreshTokenResponse,
  RequestOtpChallengeBody,
  RequestOtpChallengeResponse,
  SessionResponse,
  StaffLoginBody,
  StaffLoginResponse,
  VerifyOtpChallengeBody,
  VerifyOtpChallengeResponse,
} from '@/shared/api/contract';
import {
  DEMO_OTP_CODE,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  activeTokens,
  findByEmail,
  findByGsm,
  getRefreshSubject,
  issueToken,
  mockUsers,
  otpChallenges,
  setRefreshSubject,
  toCurrentUser,
  userFromRequest,
} from '../db';
import { fail, ok } from '../envelope';

/**
 * Kimlik uçlarının mock'u.
 *
 * ⚠️ Bu uçların GERÇEK backend'i VAR (Identity servisi yazıldı). Mock yalnızca
 * backend ayakta değilken geliştirme yapabilmek için; `VITE_API_MODE=live`
 * olduğunda devre dışı kalır ve istekler Gateway'e gider.
 *
 * Bu yüzden şekiller `contract.ts` ile birebir aynı olmalı — burada uydurulan
 * bir alan, live moda geçince sessizce kaybolur.
 *
 * Sahibi: A tarafı (kimlik akışı). Faz 0'da uygulamanın açılabilmesi için
 * asgari hâliyle yazıldı; hata senaryoları A tarafında genişletilecek.
 */

const path = (suffix: string) => `${API_PREFIX}${suffix}`;

export const identityHandlers = [
  /* ------------------------------------------------------------ OTP iste -- */
  http.post(path(endpoints.auth.otpChallenges), async ({ request }) => {
    const body = (await request.json()) as RequestOtpChallengeBody;
    const digits = body.gsmNumber.replace(/\D/g, '').slice(-10);

    if (digits.length !== 10) {
      return fail(400, 'VALIDATION_FAILED', 'Telefon numarası 10 haneli olmalıdır.', {
        field: 'gsmNumber',
      });
    }

    const challengeId = crypto.randomUUID();
    otpChallenges.set(challengeId, {
      challengeId,
      gsmNumber: digits,
      // Amaç challenge'da saklanır: doğrulama davranışını bu belirler
      // (giriş mi, kayıt mı) — backend'deki `challenge.Purpose` ile aynı.
      purpose: body.purpose,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    const response: RequestOtpChallengeResponse = {
      challengeId,
      expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      maskedGsmNumber: `${digits.slice(0, 3)} *** ** ${digits.slice(8)}`,
      // Numaranın kayıtlı olup olmadığı burada SIZDIRILMAZ — ayrım ancak kod
      // doğrulandıktan sonra yapılır (numara sayımı saldırısını önler).
      demoHint: `Demo kodu: ${DEMO_OTP_CODE}`,
    };

    return ok(response);
  }),

  /* -------------------------------------------------------- OTP doğrula -- */
  http.post(path(endpoints.auth.otpVerifications), async ({ request }) => {
    const body = (await request.json()) as VerifyOtpChallengeBody;
    const challenge = otpChallenges.get(body.challengeId);

    if (!challenge) {
      return fail(404, 'OTP_CHALLENGE_NOT_FOUND', 'Doğrulama isteği bulunamadı.');
    }

    if (Date.now() > challenge.expiresAt) {
      otpChallenges.delete(body.challengeId);
      return fail(410, 'OTP_CHALLENGE_EXPIRED', 'Kodun süresi doldu.');
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      return fail(423, 'OTP_CHALLENGE_LOCKED', 'Çok fazla hatalı deneme yaptın.');
    }

    if (body.code !== DEMO_OTP_CODE) {
      challenge.attempts += 1;
      return fail(401, 'OTP_CODE_INVALID', 'Girdiğin kod hatalı.', {
        remainingAttempts: OTP_MAX_ATTEMPTS - challenge.attempts,
      });
    }

    let user = findByGsm(challenge.gsmNumber);

    if (challenge.purpose === 'CustomerRegister') {
      if (user) {
        return fail(
          409,
          'GSM_NUMBER_ALREADY_REGISTERED',
          'Bu GSM numarasıyla zaten bir hesap mevcut.',
        );
      }

      if (!body.customer?.firstName?.trim() || !body.customer?.lastName?.trim()) {
        // Challenge SİLİNMEZ: kullanıcı bilgileri tamamlayıp aynı kodla
        // tekrar deneyebilmeli.
        return fail(400, 'VALIDATION_FAILED', 'Kayıt için ad ve soyad bilgisi zorunludur.', {
          field: 'customer',
        });
      }

      user = {
        id: `usr_customer_${crypto.randomUUID().slice(0, 8)}`,
        role: 'CUSTOMER',
        firstName: body.customer.firstName.trim(),
        lastName: body.customer.lastName.trim(),
        email: body.customer.email?.trim() || null,
        gsmNumber: `${challenge.gsmNumber.slice(0, 3)} *** ** ${challenge.gsmNumber.slice(8)}`,
        rawGsm: challenge.gsmNumber,
        specialties: [],
        regions: [],
      };
      mockUsers.push(user);
    } else if (!user) {
      // Giriş amaçlı challenge ve numara kayıtlı değil. Numaranın kayıtlı
      // OLMADIĞI SIZDIRILMAZ — kayıtlı numaralar tek tek denenerek
      // çıkarılabilirdi. Bu yüzden genel "kod hatalı" hatası döner.
      return fail(401, 'OTP_CODE_INVALID', 'Girdiğin kod hatalı.');
    }

    otpChallenges.delete(body.challengeId);

    const token = issueToken(user.id);
    const response: VerifyOtpChallengeResponse = {
      accessToken: token,
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      user: {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        gsmNumberMasked: user.gsmNumber ?? '',
      },
    };

    return ok(response);
  }),

  /* ---------------------------------------------------------- staff login -- */
  http.post(path(endpoints.auth.staffLogin), async ({ request }) => {
    const body = (await request.json()) as StaffLoginBody;
    const user = findByEmail(body.email);

    if (!user || user.password !== body.password || user.role === 'CUSTOMER') {
      return fail(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.');
    }

    const token = issueToken(user.id);
    const response: StaffLoginResponse = {
      accessToken: token,
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      user: {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        specialties: user.specialties,
        regions: user.regions,
      },
    };

    return ok(response);
  }),

  /* -------------------------------------------------------------- refresh -- */
  http.post(path(endpoints.auth.refresh), () => {
    // Gerçekte HttpOnly cookie okunur; mock'ta sessionStorage'daki özne.
    const subject = getRefreshSubject();
    if (!subject) {
      return fail(401, 'REFRESH_TOKEN_INVALID', 'Oturum bulunamadı.');
    }

    // Kayıt sırasında oluşturulan kullanıcılar bellekte tutulduğu için sayfa
    // yenilenince kaybolur. Öznesi bulunamayan refresh reddedilir; aksi hâlde
    // var olmayan bir kullanıcıya token verirdik.
    if (!mockUsers.some((user) => user.id === subject)) {
      setRefreshSubject(null);
      return fail(401, 'REFRESH_TOKEN_INVALID', 'Oturum artık geçerli değil.');
    }

    const token = issueToken(subject);
    const response: RefreshTokenResponse = {
      accessToken: token,
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
    return ok(response);
  }),

  /* --------------------------------------------------------------- logout -- */
  http.post(path(endpoints.auth.logout), ({ request }) => {
    const header = request.headers.get('Authorization');
    if (header?.startsWith('Bearer ')) {
      activeTokens.delete(header.slice('Bearer '.length));
    }
    setRefreshSubject(null);
    return ok(null);
  }),

  /* ------------------------------------------------------------------- me -- */
  http.get(path(endpoints.auth.me), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');

    const response: CurrentUserResponse = toCurrentUser(user);
    return ok(response);
  }),

  /* -------------------------------------------------------------- sessions -- */
  http.get(path(endpoints.auth.sessions), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Giriş yapmalısın.');

    const sessions: SessionResponse[] = [
      {
        id: 'ses_current',
        createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
        lastUsedAt: new Date().toISOString(),
        createdIp: '192.168.1.24',
        userAgent: navigator.userAgent,
        isCurrent: true,
      },
      {
        id: 'ses_old',
        createdAt: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
        expiresAt: new Date(Date.now() + 4 * 24 * 3600_000).toISOString(),
        lastUsedAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
        createdIp: '85.104.12.9',
        userAgent: 'FraudCell/iOS 17.4',
        isCurrent: false,
      },
    ];

    return ok(sessions);
  }),
];
