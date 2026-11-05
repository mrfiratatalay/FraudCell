import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Bell, CreditCard, Home, Plus, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LogoWordmark } from '@/shared/ui/Logo';

/**
 * Müşteri kabuğu — mobil öncelikli, masaüstünde gerçek web çalışma alanı.
 *
 * Mobilde tam ekran mobil uygulama dili (gradient, tam pill nav, ortada FAB).
 * Masaüstünde üst navigasyon ve geniş, merkezlenmiş içerik alanı kullanılır;
 * sayfalar mobil cihaz maketine sıkışmadan ekranı verimli biçimde doldurur.
 *
 * Bildirimler alt barda değil ana sayfa kahramanındaki zil ikonundadır; alt bar
 * dört ana yüzeyi + "Yeni işlem" FAB'ını taşır.
 */

interface Tab {
  to: string;
  label: string;
  icon: typeof Home;
  exact: boolean;
}

const LEFT: Tab[] = [
  { to: '/customer', label: 'Ana Sayfa', icon: Home, exact: true },
  { to: '/customer/transactions', label: 'İşlemler', icon: CreditCard, exact: false },
];

const RIGHT: Tab[] = [
  { to: '/customer/verifications', label: 'Doğrulama', icon: ShieldCheck, exact: false },
  { to: '/customer/profile', label: 'Profil', icon: User, exact: false },
];

const DESKTOP_NAV = [...LEFT, ...RIGHT];

export function CustomerShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-canvas">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-brand-50/75 to-transparent" aria-hidden />

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-brand-100/70 bg-white/88 px-4 shadow-[0_8px_26px_-24px_rgba(0,31,77,.5)] backdrop-blur-2xl lg:hidden">
        <Link to="/customer" aria-label="Ana sayfa" className="shrink-0 [&_svg]:size-8">
          <LogoWordmark />
        </Link>
        <Link
          to="/customer/notifications"
          aria-label="Bildirimler"
          className="relative flex size-10 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
        >
          <Bell className="size-5" aria-hidden />
          <span className="absolute top-2 right-2 size-2 rounded-full border-2 border-white bg-tc-500" aria-hidden />
        </Link>
      </header>

      <header className="sticky top-0 z-40 hidden border-b border-brand-100/70 bg-white/88 shadow-[0_8px_30px_-24px_rgba(0,31,77,.35)] backdrop-blur-2xl lg:block">
        <div className="mx-auto flex h-[4.75rem] w-full max-w-[90rem] items-center gap-5 px-6 xl:px-8">
          <Link to="/customer" aria-label="Ana sayfa" className="shrink-0">
            <LogoWordmark />
          </Link>

          <span className="h-7 w-px bg-ink-200" aria-hidden />

          <nav aria-label="Müşteri gezinme" className="flex min-w-0 flex-1 items-center justify-center gap-1">
            {DESKTOP_NAV.map((item) => (
              <DesktopNavTab key={item.to} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              to="/customer/notifications"
              aria-label="Bildirimler"
              className="relative flex size-11 items-center justify-center rounded-full border border-transparent text-ink-500 transition-colors hover:border-brand-100 hover:bg-brand-50 hover:text-brand-700"
            >
              <Bell className="size-5" aria-hidden />
              <span className="absolute top-2.5 right-2.5 size-2 rounded-full border-2 border-white bg-tc-500" aria-hidden />
            </Link>
            <Link
              to="/customer/transactions/new"
              className="gradient-action inline-flex items-center gap-2 rounded-pill px-5 py-3 text-sm font-bold text-brand-950 shadow-[0_10px_24px_-12px_rgba(255,201,0,.8)] transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
            >
              <Plus className="size-4" aria-hidden />
              Yeni işlem
            </Link>
          </div>
        </div>
      </header>

      <main className="relative min-h-[calc(100dvh-4rem)] pb-28 lg:min-h-[calc(100dvh-4.75rem)] lg:pb-0">
        <Outlet />
      </main>

      {/* Alt gezinme yalnızca mobil uygulama yüzünde kalır. */}
      <nav
        aria-label="Ana gezinme"
        className={cn(
          'fixed z-40 border border-white/12 bg-brand-950/97 shadow-nav backdrop-blur-xl safe-bottom',
          'inset-x-3 bottom-3 rounded-[1.4rem]',
          'lg:hidden',
        )}
      >
        <div className="relative mx-auto flex max-w-lg items-stretch px-1">
          {LEFT.map((item) => (
            <NavTab key={item.to} item={item} pathname={pathname} />
          ))}

          {/* Ortadaki yükseltilmiş aksiyon */}
          <div className="flex w-16 shrink-0 justify-center">
            <Link
              to="/customer/transactions/new"
              aria-label="Yeni işlem"
              className="gradient-action absolute -top-5 flex size-14 items-center justify-center rounded-full text-brand-950 shadow-fab ring-4 ring-canvas transition-transform hover:-translate-y-0.5 hover:brightness-105 active:scale-95"
            >
              <Plus className="size-7" aria-hidden />
            </Link>
          </div>

          {RIGHT.map((item) => (
            <NavTab key={item.to} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function DesktopNavTab({ item, pathname }: { item: Tab; pathname: string }) {
  const { to, label, icon: Icon, exact } = item;
  const active = exact ? pathname === to : pathname.startsWith(to);

  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex items-center gap-2 rounded-pill px-3.5 py-2.5 text-sm font-semibold transition-all xl:px-4',
        active
          ? 'bg-brand-50 text-brand-900 shadow-hairline'
          : 'text-ink-500 hover:bg-ink-100/70 hover:text-ink-900',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

function NavTab({ item, pathname }: { item: Tab; pathname: string }) {
  const { to, label, icon: Icon, exact } = item;
  const active = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 py-3 text-micro font-medium transition-colors',
        active ? 'text-tc-500' : 'text-console-muted hover:text-white',
      )}
    >
      <span className="relative">
        <Icon className="size-5" aria-hidden />
        {active && (
          <span
            className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-tc-500"
            aria-hidden
          />
        )}
      </span>
      {label}
    </Link>
  );
}
