import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Bell, CreditCard, Home, LogOut, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { fullName } from '@/shared/lib/format';
import { LogoWordmark } from '@/shared/ui/Logo';
import { logout } from '@/features/authentication/session';
import { useCurrentUser } from '@/features/authentication/useSession';

/**
 * Müşteri kabuğu — responsive.
 *
 * Tasarım kaynağı Paycell'in MOBİL uygulaması olduğu için küçük ekranda
 * mockup'a sadık kalıyoruz: alt navigasyon. Ancak uygulama tarayıcıda da
 * çalışıyor ve geniş ekranda alt bar tüm genişliğe yayılınca yanlış duruyor.
 *
 *   < lg  → alt navigasyon (mobil ve tablet)
 *   >= lg → üst navigasyon + ortalanmış içerik (masaüstü)
 *
 * Geçiş noktası `md` (768px) DEĞİL `lg` (1024px): beş menü + logo + kullanıcı
 * adı 768px'e sığmayıp sayfayı yatay kaydırılabilir hâle getiriyordu. Tablet
 * dikey kullanımda zaten mobil düzene daha yakın.
 *
 * Tek bir NAV listesi iki yerde de kullanılıyor; menü değişince iki yeri
 * güncelleme hatası oluşmasın diye.
 */

const NAV = [
  { to: '/customer', label: 'Ana Sayfa', icon: Home, exact: true },
  { to: '/customer/transactions', label: 'İşlemler', icon: CreditCard, exact: false },
  { to: '/customer/verifications', label: 'Doğrulama', icon: ShieldCheck, exact: false },
  { to: '/customer/notifications', label: 'Bildirim', icon: Bell, exact: false },
  { to: '/customer/profile', label: 'Profil', icon: User, exact: false },
] as const;

function isActive(pathname: string, to: string, exact: boolean): boolean {
  return exact ? pathname === to : pathname.startsWith(to);
}

export function CustomerShell() {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* ---------------------------------------- masaüstü: üst navigasyon -- */}
      <header className="sticky top-0 z-40 hidden border-b border-ink-100 bg-surface lg:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <Link to="/customer" className="shrink-0">
            <LogoWordmark />
          </Link>

          {/* min-w-0: uzun menü flex kabını şişirip sayfayı taşırmasın. */}
          <nav aria-label="Ana gezinme" className="min-w-0 flex-1">
            <ul className="flex gap-1">
              {NAV.map(({ to, label, icon: Icon, exact }) => {
                const active = isActive(pathname, to, exact);
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-pill px-3.5 py-2',
                        'text-sm font-semibold whitespace-nowrap transition-colors',
                        active
                          ? 'bg-brand-100 text-brand-800'
                          : 'text-ink-500 hover:bg-ink-100 hover:text-ink-700',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <p className="text-sm font-semibold text-ink-900">
              {fullName(user.firstName, user.lastName) || 'Müşteri'}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Çıkış yap"
              className="rounded-full p-2 text-ink-400 transition-colors hover:bg-danger-100 hover:text-danger-500"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* İçerik masaüstünde ortalanır; mobilde alt nav için altta boşluk bırakır. */}
      <main className="mx-auto w-full max-w-5xl flex-1 pb-20 lg:pb-8">
        <Outlet />
      </main>

      {/* ------------------------------------------- mobil: alt navigasyon -- */}
      <nav
        aria-label="Ana gezinme"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-surface shadow-nav safe-bottom lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = isActive(pathname, to, exact);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                    active ? 'text-brand-700' : 'text-ink-400 hover:text-ink-500',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
