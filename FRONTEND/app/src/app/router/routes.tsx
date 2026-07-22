import { createRootRouteWithContext, createRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { CASE_STATUSES, RISK_LEVELS } from '@/shared/api/enums';
import { CustomerShell } from '@/routes/shells/CustomerShell';
import { ConsoleShell } from '@/routes/shells/ConsoleShell';
import { AnalystCaseDetailScreen } from '@/features/cases/screens/AnalystCaseDetailScreen';
import { AnalystCasesScreen } from '@/features/cases/screens/AnalystCasesScreen';
import { SupervisorCaseDetailScreen } from '@/features/cases/screens/SupervisorCaseDetailScreen';
import { SupervisorCasesScreen } from '@/features/cases/screens/SupervisorCasesScreen';
import { SupervisorQueueScreen } from '@/features/cases/screens/SupervisorQueueScreen';
import { AnalystPointsScreen } from '@/features/gamification/screens/AnalystPointsScreen';
import { SupervisorLeaderboardScreen } from '@/features/gamification/screens/SupervisorLeaderboardScreen';
import { SupervisorDashboardScreen } from '@/features/dashboard/screens/SupervisorDashboardScreen';
import { RootLayout } from './RootLayout';
import { RouteStub } from './RouteStub';
import {
  HOME_BY_ROLE,
  redirectIfAuthenticated,
  requireRole,
  type RouterContext,
} from './guards';

/**
 * Route ağacı.
 *
 * Kod tabanlı (code-based) routing kullanıyoruz; dosya tabanlı üretim bir
 * derleme eklentisi gerektiriyor ve iki kişilik paralel çalışmada üretilen
 * `routeTree.gen.ts` sürekli çakışırdı. Kod tabanlı ağaçta her taraf kendi
 * route bloğunu düzenler.
 *
 * DESIGN.MD "URL bir state kaynağıdır": filtreler ve sayfalama search
 * param'larında tutulur, global store'a taşınmaz. Aşağıdaki `validateSearch`
 * kullanımları bunun referans örneğidir.
 */

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

/* ======================================================================== */
/*  /  →  role'e göre yönlendirme                                           */
/* ======================================================================== */

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    const session = context.getSession();
    if (session.status === 'authenticated' && session.user) {
      throw redirect({ to: HOME_BY_ROLE[session.user.role] });
    }
    throw redirect({ to: '/auth' });
  },
});

/* ======================================================================== */
/*  /auth  —  A tarafı                                                      */
/* ======================================================================== */

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth-layout',
  beforeLoad: ({ context }) => redirectIfAuthenticated(context),
});

const authIndexRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth',
  /**
   * Giriş sonrası kullanıcıyı gitmek istediği sayfaya geri götürmek için.
   * `catch` ile boş bırakılıyor: elle yazılmış bozuk bir URL yüzünden giriş
   * ekranı patlamamalı.
   */
  validateSearch: z.object({ redirect: z.string().optional() }).catch({}),
  component: () => (
    <RouteStub
      screen="Karşılama / Giriş seçimi"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['— (statik ekran)']}
    />
  ),
});

const authOtpRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth/otp',
  component: () => (
    <RouteStub
      screen="Telefon + OTP doğrulama"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={[
        'POST /auth/customer/otp/challenges',
        'POST /auth/customer/otp/verifications',
      ]}
    />
  ),
});

const authStaffRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth/staff',
  component: () => (
    <RouteStub
      screen="Personel girişi"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['POST /auth/staff/login']}
    />
  ),
});

/* ======================================================================== */
/*  /customer  —  A tarafı                                                  */
/* ======================================================================== */

const customerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/customer',
  beforeLoad: ({ context, location }) => requireRole(context, location.href, 'CUSTOMER'),
  component: CustomerShell,
});

const customerHomeRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/',
  component: () => (
    <RouteStub
      screen="Müşteri ana sayfası"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['GET /transactions?limit=5', 'GET /customer/verifications/pending']}
    />
  ),
});

const customerTransactionsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/transactions',
  /** Filtreler URL'de: sayfa yenilenince kaybolmaz, link paylaşılabilir. */
  validateSearch: z
    .object({
      riskLevel: z.enum(RISK_LEVELS).optional(),
      cursor: z.string().optional(),
    })
    .catch({}),
  component: () => (
    <RouteStub
      screen="İşlem listesi"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['GET /transactions']}
    />
  ),
});

const customerNewTransactionRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/transactions/new',
  component: () => (
    <RouteStub
      screen="Yeni işlem"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['POST /transactions  (Idempotency-Key zorunlu)']}
    />
  ),
});

const customerTransactionDetailRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/transactions/$transactionId',
  component: () => (
    <RouteStub
      screen="İşlem detayı"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['GET /transactions/{id}']}
    />
  ),
});

const customerVerificationsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/verifications',
  component: () => (
    <RouteStub
      screen="Bekleyen doğrulamalar"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={[
        'GET /customer/verifications/pending',
        'POST /cases/{id}/verification-responses',
      ]}
    />
  ),
});

const customerNotificationsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/notifications',
  component: () => (
    <RouteStub
      screen="Bildirimler"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['⚠ MSW mock — Notification servisi yazılmadı']}
    />
  ),
});

const customerProfileRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/profile',
  component: () => (
    <RouteStub
      screen="Profil ve güvenlik"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['GET /auth/me', 'GET /auth/sessions', 'DELETE /auth/sessions/{id}']}
    />
  ),
});

/* ======================================================================== */
/*  /analyst  —  B tarafı                                                   */
/* ======================================================================== */

const analystRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analyst',
  beforeLoad: ({ context, location }) => requireRole(context, location.href, 'ANALYST'),
  component: ConsoleShell,
});

export const analystCasesRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/',
  validateSearch: z.object({ status: z.enum(CASE_STATUSES).optional() }).catch({}),
  component: AnalystCasesScreen,
});

export const analystCaseDetailRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/cases/$caseId',
  component: AnalystCaseDetailScreen,
});

export const analystPointsRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/points',
  component: AnalystPointsScreen,
});

/* ======================================================================== */
/*  /supervisor  —  B tarafı                                                */
/* ======================================================================== */

const supervisorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/supervisor',
  beforeLoad: ({ context, location }) =>
    requireRole(context, location.href, 'SUPERVISOR', 'ADMIN'),
  component: ConsoleShell,
});

export const supervisorDashboardRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/',
  component: SupervisorDashboardScreen,
});

/**
 * Filtrelerin URL'de tutulmasının referans örneği.
 *
 * `/supervisor/cases?status=ATANDI&riskLevel=KRITIK` paylaşılabilir, geri/ileri
 * tuşları doğru çalışır ve sayfa yenilenince filtre kaybolmaz. Cursor da
 * buradadır çünkü backend keyset pagination kullanıyor — sayfa numarası yok.
 */
export const supervisorCasesRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/cases',
  validateSearch: z
    .object({
      status: z.enum(CASE_STATUSES).optional(),
      riskLevel: z.enum(RISK_LEVELS).optional(),
      cursor: z.string().optional(),
    })
    .catch({}),
  component: SupervisorCasesScreen,
});

export const supervisorCaseDetailRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/cases/$caseId',
  component: SupervisorCaseDetailScreen,
});

export const supervisorQueueRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/queue',
  validateSearch: z
    .object({ queueType: z.enum(['QUEUED', 'MANUAL_QUEUE']).default('QUEUED') })
    .catch({ queueType: 'QUEUED' }),
  component: SupervisorQueueScreen,
});

export const supervisorLeaderboardRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/leaderboard',
  validateSearch: z
    .object({ period: z.enum(['daily', 'weekly']).default('daily') })
    .catch({ period: 'daily' }),
  component: SupervisorLeaderboardScreen,
});

/* ======================================================================== */
/*  /admin  —  A tarafı                                                     */
/* ======================================================================== */

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  beforeLoad: ({ context, location }) => requireRole(context, location.href, 'ADMIN'),
  component: ConsoleShell,
});

const adminStaffRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  component: () => (
    <RouteStub
      screen="Personel yönetimi"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={[
        'GET /staff',
        'POST /staff',
        'PATCH /staff/{id}  (If-Match)',
        'PUT /staff/{id}/role|specialties|regions  (If-Match)',
        'GET /reference/roles|specialties|regions',
      ]}
    />
  ),
});

const adminAuditRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/audit',
  validateSearch: z
    .object({ action: z.string().optional(), cursor: z.string().optional() })
    .catch({}),
  component: () => (
    <RouteStub
      screen="Denetim kayıtları"
      owner="A — Müşteri & Kimlik & Admin"
      endpoints={['GET /audit-logs', 'GET /audit-logs/{id}']}
    />
  ),
});

/* ======================================================================== */

export const routeTree = rootRoute.addChildren([
  indexRoute,

  authLayoutRoute.addChildren([authIndexRoute, authOtpRoute, authStaffRoute]),

  customerRoute.addChildren([
    customerHomeRoute,
    customerTransactionsRoute,
    // Sabit yol, parametreli yoldan ÖNCE gelmeli; aksi hâlde "new" bir
    // transactionId olarak yakalanır.
    customerNewTransactionRoute,
    customerTransactionDetailRoute,
    customerVerificationsRoute,
    customerNotificationsRoute,
    customerProfileRoute,
  ]),

  analystRoute.addChildren([analystCasesRoute, analystCaseDetailRoute, analystPointsRoute]),

  supervisorRoute.addChildren([
    supervisorDashboardRoute,
    supervisorCasesRoute,
    supervisorCaseDetailRoute,
    supervisorQueueRoute,
    supervisorLeaderboardRoute,
  ]),

  adminRoute.addChildren([adminStaffRoute, adminAuditRoute]),
]);
