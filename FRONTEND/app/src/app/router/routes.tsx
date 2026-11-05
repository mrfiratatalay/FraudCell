import {
  createRootRouteWithContext,
  createRoute,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';

import { CASE_STATUSES, RISK_LEVELS } from '@/shared/api/enums';
import { CustomerShell } from '@/routes/shells/CustomerShell';
import { ConsoleShell } from '@/routes/shells/ConsoleShell';
import { AuthLandingPage } from '@/routes/auth/AuthLandingPage';
import { CustomerOtpPage } from '@/routes/auth/CustomerOtpPage';
import { StaffLoginPage } from '@/routes/auth/StaffLoginPage';
import { RootLayout } from './RootLayout';
import {
  HOME_BY_ROLE,
  redirectIfAuthenticated,
  requireRole,
  type RouterContext,
} from './guards';

const AssignedCasesPage = lazyRouteComponent(
  () => import('@/routes/analyst/AssignedCasesPage'),
  'AssignedCasesPage',
);
const AuditLogsPage = lazyRouteComponent(
  () => import('@/routes/admin/AuditLogsPage'),
  'AuditLogsPage',
);
const StaffManagementPage = lazyRouteComponent(
  () => import('@/routes/admin/StaffManagementPage'),
  'StaffManagementPage',
);
const AnalystPointsPage = lazyRouteComponent(
  () => import('@/routes/analyst/AnalystPointsPage'),
  'AnalystPointsPage',
);
const CaseDetailPage = lazyRouteComponent(
  () => import('@/routes/analyst/CaseDetailPage'),
  'CaseDetailPage',
);
const CustomerHomePage = lazyRouteComponent(
  () => import('@/routes/customer/CustomerHomePage'),
  'CustomerHomePage',
);
const CustomerNotificationsPage = lazyRouteComponent(
  () => import('@/routes/customer/CustomerNotificationsPage'),
  'CustomerNotificationsPage',
);
const CustomerProfilePage = lazyRouteComponent(
  () => import('@/routes/customer/CustomerProfilePage'),
  'CustomerProfilePage',
);
const CustomerTransactionsPage = lazyRouteComponent(
  () => import('@/routes/customer/CustomerTransactionsPage'),
  'CustomerTransactionsPage',
);
const CustomerVerificationsPage = lazyRouteComponent(
  () => import('@/routes/customer/CustomerVerificationsPage'),
  'CustomerVerificationsPage',
);
const NewTransactionPage = lazyRouteComponent(
  () => import('@/routes/customer/NewTransactionPage'),
  'NewTransactionPage',
);
const TransactionDetailPage = lazyRouteComponent(
  () => import('@/routes/customer/TransactionDetailPage'),
  'TransactionDetailPage',
);
const LeaderboardPage = lazyRouteComponent(
  () => import('@/routes/supervisor/LeaderboardPage'),
  'LeaderboardPage',
);
const AssignmentQueuePage = lazyRouteComponent(
  () => import('@/routes/supervisor/AssignmentQueuePage'),
  'AssignmentQueuePage',
);
const SupervisorCaseDetailPage = lazyRouteComponent(
  () => import('@/routes/supervisor/SupervisorCaseDetailPage'),
  'SupervisorCaseDetailPage',
);
const SupervisorCasesPage = lazyRouteComponent(
  () => import('@/routes/supervisor/SupervisorCasesPage'),
  'SupervisorCasesPage',
);
const SupervisorDashboardPage = lazyRouteComponent(
  () => import('@/routes/supervisor/SupervisorDashboardPage'),
  'SupervisorDashboardPage',
);

/**
 * Route ağacı.
 *
 * Kod tabanlı (code-based) routing kullanıyoruz; dosya tabanlı üretim bir
 * derleme eklentisi gerektiriyor ve iki kişilik paralel çalışmada üretilen
 * `routeTree.gen.ts` sürekli çakışırdı. Kod tabanlı ağaçta her taraf kendi
 * route bloğunu düzenler.
 *
 * filtreler ve sayfalama search
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
  component: AuthIndexPage,
});

function AuthIndexPage() {
  const { redirect: redirectTo } = authIndexRoute.useSearch();
  return <AuthLandingPage redirectTo={redirectTo} />;
}

const authOtpRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth/otp',
  validateSearch: z
    .object({
      mode: z.enum(['login', 'register']).default('login'),
      redirect: z.string().optional(),
    })
    .catch({ mode: 'login' as const }),
  component: AuthOtpPage,
});

function AuthOtpPage() {
  const { mode, redirect: redirectTo } = authOtpRoute.useSearch();
  return <CustomerOtpPage mode={mode} redirectTo={redirectTo} />;
}

const authStaffRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/auth/staff',
  validateSearch: z.object({ redirect: z.string().optional() }).catch({}),
  component: AuthStaffPage,
});

function AuthStaffPage() {
  const { redirect: redirectTo } = authStaffRoute.useSearch();
  return <StaffLoginPage redirectTo={redirectTo} />;
}

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
  component: CustomerHomePage,
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
  component: CustomerTransactionsRoutePage,
});

function CustomerTransactionsRoutePage() {
  const { riskLevel } = customerTransactionsRoute.useSearch();
  return <CustomerTransactionsPage riskLevel={riskLevel} />;
}

const customerNewTransactionRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/transactions/new',
  component: NewTransactionPage,
});

const customerTransactionDetailRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/transactions/$transactionId',
  component: CustomerTransactionDetailRoutePage,
});

function CustomerTransactionDetailRoutePage() {
  const { transactionId } = customerTransactionDetailRoute.useParams();
  return <TransactionDetailPage transactionId={transactionId} />;
}

const customerVerificationsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/verifications',
  component: CustomerVerificationsPage,
});

const customerNotificationsRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/notifications',
  component: CustomerNotificationsPage,
});

const customerProfileRoute = createRoute({
  getParentRoute: () => customerRoute,
  path: '/profile',
  component: CustomerProfilePage,
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
  component: AnalystCasesRoutePage,
});

function AnalystCasesRoutePage() {
  const { status } = analystCasesRoute.useSearch();
  return <AssignedCasesPage status={status} />;
}

const analystCaseDetailRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/cases/$caseId',
  component: AnalystCaseDetailRoutePage,
});

function AnalystCaseDetailRoutePage() {
  const { caseId } = analystCaseDetailRoute.useParams();
  return <CaseDetailPage caseId={caseId} />;
}

const analystPointsRoute = createRoute({
  getParentRoute: () => analystRoute,
  path: '/points',
  component: AnalystPointsPage,
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
  component: SupervisorDashboardPage,
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
  component: SupervisorCasesRoutePage,
});

function SupervisorCasesRoutePage() {
  const search = supervisorCasesRoute.useSearch();
  return <SupervisorCasesPage {...search} />;
}

const supervisorCaseDetailRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/cases/$caseId',
  component: SupervisorCaseDetailRoutePage,
});

function SupervisorCaseDetailRoutePage() {
  const { caseId } = supervisorCaseDetailRoute.useParams();
  return <SupervisorCaseDetailPage caseId={caseId} />;
}

const supervisorQueueRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/queue',
  validateSearch: z
    .object({ queueType: z.enum(['ALL', 'QUEUED', 'MANUAL_QUEUE']).default('ALL') })
    .catch({ queueType: 'ALL' }),
  component: SupervisorQueueRoutePage,
});

function SupervisorQueueRoutePage() {
  const { queueType } = supervisorQueueRoute.useSearch();
  return <AssignmentQueuePage queueType={queueType} />;
}

const supervisorLeaderboardRoute = createRoute({
  getParentRoute: () => supervisorRoute,
  path: '/leaderboard',
  validateSearch: z
    .object({ period: z.enum(['daily', 'weekly']).default('daily') })
    .catch({ period: 'daily' }),
  component: SupervisorLeaderboardRoutePage,
});

function SupervisorLeaderboardRoutePage() {
  const { period } = supervisorLeaderboardRoute.useSearch();
  return <LeaderboardPage period={period} />;
}

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
  component: StaffManagementPage,
});

const adminAuditRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/audit',
  validateSearch: z
    .object({ action: z.string().optional(), cursor: z.string().optional() })
    .catch({}),
  component: AdminAuditRoutePage,
});

function AdminAuditRoutePage() {
  const { action, cursor } = adminAuditRoute.useSearch();
  return <AuditLogsPage action={action} cursor={cursor} />;
}

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
