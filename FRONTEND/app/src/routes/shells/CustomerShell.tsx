import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Bell, CreditCard, Home, Plus, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { LogoWordmark } from '@/shared/ui/Logo';
import { ThemeToggle } from '@/shared/ui';

/**
 * Customer shell: a top bar everywhere, and on a phone a plain bottom tab bar
 * — the layout of a banking app, not a landing page.
 */

interface Tab {
  to: string;
  label: string;
  icon: typeof Home;
  exact: boolean;
}

const TABS: Tab[] = [
  { to: '/customer', label: 'Ana Sayfa', icon: Home, exact: true },
  { to: '/customer/transactions', label: 'İşlemler', icon: CreditCard, exact: false },
  { to: '/customer/verifications', label: 'Doğrulama', icon: ShieldCheck, exact: false },
  { to: '/customer/profile', label: 'Profil', icon: User, exact: false },
];

function isActive(tab: Tab, pathname: string): boolean {
  if (tab.exact) return pathname === tab.to || pathname === `${tab.to}/`;
  return pathname.startsWith(tab.to) && !(tab.to === '/customer/transactions' && pathname.endsWith('/new'));
}

export function CustomerShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4 sm:px-6">
          <Link to="/customer" aria-label="Ana sayfa" className="shrink-0 rounded-lg">
            <LogoWordmark />
          </Link>

          <nav aria-label="Müşteri gezinme" className="hidden items-center gap-1 lg:flex">
            {TABS.map((tab) => {
              const active = isActive(tab, pathname);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-14 items-center px-3 text-[13px] font-medium transition-colors',
                    active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900',
                    active && 'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-tc-500',
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/customer/notifications"
              aria-label="Bildirimler"
              className="flex size-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <Bell className="size-4" aria-hidden />
            </Link>
            <ThemeToggle />
            <Link
              to="/customer/transactions/new"
              className="ml-2 hidden h-8 items-center gap-1.5 rounded-control bg-tc-500 px-3 text-[13px] font-semibold text-night-900 transition-colors hover:bg-tc-400 lg:inline-flex"
            >
              <Plus className="size-4" aria-hidden />
              Yeni işlem
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-24 lg:pb-0">
        <Outlet />
      </main>

      <nav
        aria-label="Ana gezinme"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-lg">
          {TABS.map((tab) => {
            const active = isActive(tab, pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors',
                  active ? 'text-ink-900' : 'text-ink-500',
                )}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-tc-500" aria-hidden />}
                <Icon className={cn('size-5', active && 'text-brand-600')} aria-hidden />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
