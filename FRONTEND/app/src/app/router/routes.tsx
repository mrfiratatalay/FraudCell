import { createRootRouteWithContext, createRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { CASE_STATUSES, RISK_LEVELS } from '@/shared/api/enums';
import { CustomerShell } from '@/routes/shells/CustomerShell';
import { ConsoleShell } from '@/routes/shells/ConsoleShell';
import { Welcome } from '@/routes/auth/Welcome';
import { CustomerLogin } from '@/routes/auth/CustomerLogin';
import { CustomerRegister } from '@/routes/auth/CustomerRegister';
import { StaffLogin } from '@/routes/auth/StaffLogin';
import { CustomerHome } from '@/routes/customer/Home';
import { CustomerTransactions } from '@/routes/customer/Transactions';
import { NewTransaction } from '@/routes/customer/NewTransaction';
import { TransactionDetail } from '@/routes/customer/TransactionDetail';
import { CustomerVerifications } from '@/routes/customer/Verifications';
import { CustomerNotifications } from '@/routes/customer/Notifications';
import { CustomerProfile } from '@/routes/customer/Profile';
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
  component: Welcome,
});

/** Giriş: purpose=CustomerLogin. Kayıtsız numarada backend ayrım sızdırmaz. */
const authLoginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth/login',
  component: CustomerLogin,
});

/** Kayıt: purpose=CustomerRegister. Ad/soyad doğrulama gövdesinde gider. */
const authRegisterRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth/register',
  component: CustomerRegister,
});

const authStaffRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth/staff',
  component: StaffLogin,
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
  component: CustomerHome,
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
  component: CustomerTransactions,
});

const customerNewTransactionRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/transactions/new',
  component: NewTransaction,
});

const customerTransactionDetailRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/transactions/$transactionId',
  component: TransactionDetail,
});

const customerVerificationsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/verifications',
  component: CustomerVerifications,
});

const customerNotificationsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/notifications',
  component: CustomerNotifications,
});

const customerProfileRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/profile',
  component: CustomerProfile,
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

const analystCasesRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/',
  validateSearch: z.object({ status: z.enum(CASE_STATUSES).optional() }).catch({}),
  component: () => (
    <RouteStub
      screen="Vakalarım"
      owner="B — Operasyon Konsolu"
      endpoints={['GET /cases/assigned']}
    />
  ),
});

const analystCaseDetailRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/cases/$caseId',
  component: () => (
    <RouteStub
      screen="Vaka detayı ve karar"
      owner="B — Operasyon Konsolu"
      endpoints={[
        'GET /cases/{id}',
        'GET /cases/{id}/history',
        'GET|POST /cases/{id}/notes',
        'POST /cases/{id}/review',
        'POST /cases/{id}/verification-requests',
        'PATCH /cases/{id}/decision  (If-Match)',
      ]}
    />
  ),
});

const analystPointsRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/points',
  component: () => (
    <RouteStub
      screen="Puanlarım ve rozetler"
      owner="B — Operasyon Konsolu"
      endpoints={['⚠ MSW mock — Gamification servisi yazılmadı']}
    />
  ),
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

const supervisorDashboardRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/',
  component: () => (
    <RouteStub
      screen="Operasyon panosu"
      owner="B — Operasyon Konsolu"
      endpoints={['⚠ MSW mock — aggregate ucu yok', '⚠ MSW mock — AI metrikleri']}
    />
  ),
});

/**
 * Filtrelerin URL'de tutulmasının referans örneği.
 *
 * `/supervisor/cases?status=ATANDI&riskLevel=KRITIK` paylaşılabilir, geri/ileri
 * tuşları doğru çalışır ve sayfa yenilenince filtre kaybolmaz. Cursor da
 * buradadır çünkü backend keyset pagination kullanıyor — sayfa numarası yok.
 */
const supervisorCasesRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/cases',
  validateSearch: z
    .object({
      status: z.enum(CASE_STATUSES).optional(),
      riskLevel: z.enum(RISK_LEVELS).optional(),
      cursor: z.string().optional(),
    })
    .catch({}),
  component: () => (
    <RouteStub
      screen="Tüm vakalar"
      owner="B — Operasyon Konsolu"
      endpoints={['GET /cases?status=&riskLevel=&cursor=&limit=']}
    />
  ),
});

const supervisorCaseDetailRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/cases/$caseId',
  component: () => (
    <RouteStub
      screen="Vaka detayı (süpervizör)"
      owner="B — Operasyon Konsolu"
      endpoints={[
        'GET /cases/{id}',
        'PUT /cases/{id}/assignment  (If-Match)',
        'POST /cases/{id}/reassignments',
        'PATCH /cases/{id}/fraud-type  (If-Match)',
        'PATCH /cases/{id}/risk-level  (If-Match)',
      ]}
    />
  ),
});

const supervisorQueueRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/queue',
  validateSearch: z
    .object({ queueType: z.enum(['QUEUED', 'MANUAL_QUEUE']).default('QUEUED') })
    .catch({ queueType: 'QUEUED' }),
  component: () => (
    <RouteStub
      screen="Atama kuyruğu"
      owner="B — Operasyon Konsolu"
      endpoints={['GET /cases/assignment-queue?queueType=']}
    />
  ),
});

const supervisorLeaderboardRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/leaderboard',
  validateSearch: z
    .object({ period: z.enum(['daily', 'weekly']).default('daily') })
    .catch({ period: 'daily' }),
  component: () => (
    <RouteStub
      screen="Liderlik tablosu"
      owner="B — Operasyon Konsolu"
      endpoints={['⚠ MSW mock — Gamification servisi yazılmadı']}
    />
  ),
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

  authLayoutRoute.addChildren([
    authIndexRoute,
    authLoginRoute,
    authRegisterRoute,
    authStaffRoute,
  ]),

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
