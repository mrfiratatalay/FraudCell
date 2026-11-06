/** Demo versions of the identity endpoints: sign-in, sessions, staff, reference data, audit. */
import { http } from 'msw';
import { API_PREFIX } from '@/shared/config/env';
import { endpoints } from '@/shared/api/endpoints';
import type { CreateStaffBody, StaffLoginBody, UpdateStaffBody, VerifyOtpChallengeBody } from '@/shared/api/contract';
import { FRAUD_TYPE_LABEL, REGION_LABEL, ROLE_LABEL, type AnalystSpecialty, type OperationRegion, type Role } from '@/shared/api/enums';
import { checkIfMatch, fail, ok, paginate, readLimit, withETag } from './envelope';
import { staffResponse } from './mappers';
import { db, DEMO_PASSWORD, newId, save, type DemoUser } from './store';

export const p = (suffix: string) => `${API_PREFIX}${suffix}`;
const DEMO_OTP = '1234';
const challenges = new Map<string, { gsm: string; register: boolean; expiresAt: number }>();

const token = (u: DemoUser) => ({ accessToken: `demo.${u.id}`, accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
const maskGsm = (gsm: string) => `+90******${gsm.slice(-4)}`;

export function currentUser(request: Request): DemoUser | null {
  const auth = request.headers.get('Authorization') ?? '';
  const id = auth.startsWith('Bearer demo.') ? auth.slice('Bearer demo.'.length) : null;
  return db().users.find((u) => u.id === id && u.isActive) ?? null;
}

export function requireRole(request: Request, ...roles: Role[]): DemoUser | Response {
  const user = currentUser(request);
  if (!user) return fail(401, 'AUTHENTICATION_REQUIRED', 'Oturum açmanız gerekiyor.');
  if (roles.length && !roles.includes(user.role)) return fail(403, 'FORBIDDEN', 'Bu işlem için yetkiniz yok.');
  return user;
}

export function audit(user: DemoUser | null, action: string, resourceType: string | null, resourceId: string | null, service = 'identity-service') {
  db().audit.push({ id: newId('aud'), actorId: user?.id ?? null, actorRole: user?.role ?? null, action, service, resourceType, resourceId, result: 'SUCCESS', at: new Date().toISOString() });
}

function startSession(u: DemoUser) {
  db().sessionUserId = u.id;
  audit(u, 'LOGIN_SUCCEEDED', 'user', u.id);
  save();
}

export const identityHandlers = [
  http.post(p(endpoints.auth.otpChallenges), async ({ request }) => {
    const body = (await request.json()) as { gsmNumber: string; purpose: string };
    const gsm = body.gsmNumber.replace(/\D/g, '').slice(-10);
    if (!/^5\d{9}$/.test(gsm)) return fail(400, 'VALIDATION_FAILED', 'Geçerli bir cep telefonu numarası gir.');
    const id = crypto.randomUUID();
    const expiresAt = Date.now() + 5 * 60_000;
    challenges.set(id, { gsm, register: body.purpose === 'CustomerRegister', expiresAt });
    return ok({ challengeId: id, expiresAt: new Date(expiresAt).toISOString(), maskedGsmNumber: maskGsm(gsm), demoHint: `Demo ortamında OTP: ${DEMO_OTP}` });
  }),

  http.post(p(endpoints.auth.otpVerifications), async ({ request }) => {
    const body = (await request.json()) as VerifyOtpChallengeBody;
    const ch = challenges.get(body.challengeId);
    if (!ch || ch.expiresAt < Date.now()) return fail(400, 'OTP_EXPIRED', 'Kodun süresi doldu, yeni kod iste.');
    if (body.code !== DEMO_OTP) return fail(400, 'OTP_INVALID', 'Girdiğin kod hatalı.');
    let u = db().users.find((x) => x.role === 'CUSTOMER' && x.gsm === ch.gsm);
    if (!u) {
      if (!body.customer) return fail(404, 'CUSTOMER_NOT_FOUND', 'Bu numarayla kayıtlı müşteri yok; önce kayıt ol.');
      u = {
        id: newId('cus'), role: 'CUSTOMER', firstName: body.customer.firstName, lastName: body.customer.lastName,
        email: body.customer.email, gsm: ch.gsm, specialties: [], regions: [], assignmentEnabled: false, isActive: true, version: 1, createdAt: new Date().toISOString(),
      };
      db().users.push(u);
    }
    challenges.delete(body.challengeId);
    startSession(u);
    return ok({ ...token(u), user: { id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName, gsmNumberMasked: maskGsm(ch.gsm) } });
  }),

  http.post(p(endpoints.auth.staffLogin), async ({ request }) => {
    const body = (await request.json()) as StaffLoginBody;
    const u = db().users.find((x) => x.role !== 'CUSTOMER' && x.email === body.email.trim().toLowerCase());
    if (!u || !u.isActive || body.password !== DEMO_PASSWORD) return fail(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.');
    startSession(u);
    return ok({ ...token(u), user: { id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName, specialties: u.specialties, regions: u.regions } });
  }),

  http.post(p(endpoints.auth.refresh), () => {
    const u = db().users.find((x) => x.id === db().sessionUserId && x.isActive);
    return u ? ok(token(u)) : fail(401, 'REFRESH_TOKEN_INVALID', 'Oturum bulunamadı.');
  }),

  http.post(p(endpoints.auth.logout), () => {
    db().sessionUserId = null;
    save();
    return ok(null);
  }),

  http.get(p(endpoints.auth.me), ({ request }) => {
    const u = currentUser(request);
    if (!u) return fail(401, 'AUTHENTICATION_REQUIRED', 'Oturum açmanız gerekiyor.');
    return ok({ id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName, email: u.email, gsmNumber: u.gsm ? maskGsm(u.gsm) : null, specialties: u.specialties, regions: u.regions });
  }),

  http.get(p(endpoints.auth.sessions), ({ request }) => {
    const u = currentUser(request);
    if (!u) return fail(401, 'AUTHENTICATION_REQUIRED', 'Oturum açmanız gerekiyor.');
    const now = Date.now();
    return ok([
      { id: 'ses-current', createdAt: new Date(now - 20 * 60_000).toISOString(), expiresAt: new Date(now + 7 * 864e5).toISOString(), lastUsedAt: new Date(now).toISOString(), createdIp: '127.0.0.1', userAgent: navigator.userAgent, isCurrent: true },
    ]);
  }),
  http.delete(p(endpoints.auth.session(':id')), () => ok(null)),

  /* ------------------------------------------------------------- staff -- */
  http.get(p(endpoints.staff.root), ({ request }) => {
    const auth = requireRole(request, 'ADMIN', 'SUPERVISOR');
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const staff = db().users.filter((u) => u.role !== 'CUSTOMER').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(paginate(staff.map(staffResponse), url.searchParams.get('cursor'), readLimit(url, 100)));
  }),

  http.post(p(endpoints.staff.root), async ({ request }) => {
    const admin = requireRole(request, 'ADMIN');
    if (admin instanceof Response) return admin;
    const body = (await request.json()) as CreateStaffBody;
    const email = body.email.trim().toLowerCase();
    if (db().users.some((u) => u.email === email)) return fail(409, 'EMAIL_ALREADY_EXISTS', 'Bu e-posta ile kayıtlı bir personel var.');
    const u: DemoUser = {
      id: newId('stf'), role: body.role, firstName: body.firstName, lastName: body.lastName, email, gsm: null,
      specialties: body.specialties, regions: body.regions, assignmentEnabled: body.assignmentEnabled ?? body.role === 'ANALYST',
      isActive: true, version: 1, createdAt: new Date().toISOString(),
    };
    db().users.push(u);
    audit(admin, 'STAFF_CREATED', 'user', u.id);
    save();
    return ok(staffResponse(u));
  }),

  http.get(p(endpoints.staff.byId(':id')), ({ request, params }) => {
    const auth = requireRole(request, 'ADMIN');
    if (auth instanceof Response) return auth;
    const u = db().users.find((x) => x.id === params.id);
    return u ? withETag(ok(staffResponse(u)), u.version) : fail(404, 'NOT_FOUND', 'Personel bulunamadı.');
  }),

  ...(['byId', 'role', 'specialties', 'regions'] as const).map((part) =>
    (part === 'byId' ? http.patch : http.put)(p(part === 'byId' ? endpoints.staff.byId(':id') : endpoints.staff[part](':id')), async ({ request, params }) => {
      const admin = requireRole(request, 'ADMIN');
      if (admin instanceof Response) return admin;
      const u = db().users.find((x) => x.id === params.id);
      if (!u) return fail(404, 'NOT_FOUND', 'Personel bulunamadı.');
      const mismatch = checkIfMatch(request, u.version);
      if (mismatch) return mismatch;
      const body = (await request.json()) as UpdateStaffBody & { role?: Role; specialties?: AnalystSpecialty[]; regions?: OperationRegion[] };
      if (part === 'byId') {
        if (body.firstName) u.firstName = body.firstName;
        if (body.lastName) u.lastName = body.lastName;
        if (body.assignmentEnabled != null) u.assignmentEnabled = body.assignmentEnabled;
        if (body.isActive != null) u.isActive = body.isActive;
      } else if (part === 'role' && body.role) u.role = body.role;
      else if (part === 'specialties' && body.specialties) u.specialties = body.specialties;
      else if (part === 'regions' && body.regions) u.regions = body.regions;
      u.version += 1;
      audit(admin, 'STAFF_UPDATED', 'user', u.id);
      save();
      return withETag(ok(staffResponse(u)), u.version);
    }),
  ),

  /* --------------------------------------------------------- reference -- */
  http.get(p(endpoints.reference.roles), () => ok(Object.entries(ROLE_LABEL).map(([code, displayName]) => ({ code, displayName })))),
  http.get(p(endpoints.reference.specialties), () =>
    ok((['CALINTI_KART', 'HESAP_ELE_GECIRME', 'PARA_AKLAMA', 'SUPHELI_DAVRANIS'] as const).map((code) => ({ code, displayName: FRAUD_TYPE_LABEL[code] }))),
  ),
  http.get(p(endpoints.reference.regions), () => ok(Object.entries(REGION_LABEL).map(([code, displayName]) => ({ code, displayName })))),

  /* ------------------------------------------------------------- audit -- */
  http.get(p(endpoints.audit.logs), ({ request }) => {
    const auth = requireRole(request, 'ADMIN');
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const rows = [...db().audit]
      .filter((a) => !action || a.action === action)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => ({ id: a.id, actorId: a.actorId, actorRole: a.actorRole, action: a.action, sourceService: a.service, resourceType: a.resourceType, resourceId: a.resourceId, ipAddress: '127.0.0.1', result: a.result, occurredAt: a.at, detailsJson: null }));
    return ok(paginate(rows, url.searchParams.get('cursor'), readLimit(url, 20)));
  }),
];
