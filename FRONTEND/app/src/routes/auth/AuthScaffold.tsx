import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/shared/lib/cn';
import { LogoWordmark } from '@/shared/ui/Logo';
import { ThemeToggle } from '@/shared/ui/ThemeToggle';

/**
 * Sign-in layout.
 *
 * Left: the form, always. Right (lg+): a still of the product doing its job —
 * one transaction moving from AI scoring to an analyst — so the first screen
 * explains the system instead of selling it.
 */

export type AuthTab = 'customer' | 'staff';

export function AuthScaffold({ children, tab }: { children: ReactNode; tab?: AuthTab }) {
  return (
    <div className="min-h-dvh w-full bg-surface lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:overflow-hidden">
      <div className="flex min-h-dvh min-w-0 flex-col px-5 py-5 sm:px-10 sm:py-8 lg:min-h-0 lg:overflow-y-auto">
        <header className="flex items-center justify-between gap-4">
          <Link to="/auth" aria-label="FraudCell giriş" className="rounded-lg">
            <LogoWordmark />
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            {tab ? <AuthTabs active={tab} /> : null}
            {children}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>FraudCell · Fırat Atalay &amp; Ayşe Mandıralı</span>
          <span>CodeNight 2026 All-Star</span>
        </footer>
      </div>

      <ProductStill />
    </div>
  );
}

function AuthTabs({ active }: { active: AuthTab }) {
  const item = (tab: AuthTab, to: '/auth' | '/auth/staff', label: string) => (
    <Link
      to={to}
      aria-current={active === tab ? 'page' : undefined}
      className={cn(
        'flex h-8 flex-1 items-center justify-center rounded-md text-[13px] font-medium transition-colors',
        active === tab
          ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgba(0,19,49,.12)] ring-1 ring-line'
          : 'text-ink-500 hover:text-ink-900',
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Giriş türü" className="mb-8 flex gap-1 rounded-lg bg-ink-100 p-1">
      {item('customer', '/auth', 'Müşteri')}
      {item('staff', '/auth/staff', 'Personel')}
    </nav>
  );
}

export function AuthFlow({
  titleId,
  title,
  description,
  children,
}: {
  titleId: string;
  /** Kept for callers; the redesigned header has no icon tile. */
  icon?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={titleId} className="animate-rise">
      <h1 id={titleId} className="text-[1.625rem] leading-tight font-semibold tracking-[-0.03em] text-ink-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-ink-500">{description}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------ brand panel -- */

const PILLARS = [
  { title: 'Saniyeler içinde', detail: 'Her işlem yapay zekâ ile skorlanır' },
  { title: 'SLA ile takip', detail: 'Riskli vaka doğru analiste düşer' },
  { title: 'Açıklanabilir', detail: 'Her kararın gerekçesi görünür' },
];

/** Quiet brand side: one emblem, one sentence, three facts. Nothing pretends to be live data. */
function ProductStill() {
  return (
    <aside aria-hidden className="on-night relative hidden overflow-hidden bg-night-900 text-white lg:flex lg:flex-col">
      {/* light */}
      <div className="absolute -top-40 -right-40 size-[38rem] rounded-full bg-[radial-gradient(closest-side,rgba(26,111,209,.55),transparent)]" />
      <div className="absolute -bottom-48 -left-32 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,201,0,.16),transparent)]" />

      {/* emblem */}
      <div className="relative flex flex-1 items-center justify-center">
        <div className="relative">
          <span className="absolute inset-0 -m-16 rounded-full border border-white/[0.06]" />
          <span className="absolute inset-0 -m-32 rounded-full border border-white/[0.04]" />
          <svg viewBox="0 0 120 132" className="relative h-56 w-auto drop-shadow-[0_0_40px_rgba(255,201,0,.18)] xl:h-64">
            <defs>
              <linearGradient id="shield-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0f2a52" />
                <stop offset="1" stopColor="#061632" />
              </linearGradient>
            </defs>
            <path
              d="M60 6 110 25v35c0 33-21 57-50 66C31 117 10 93 10 60V25L60 6Z"
              fill="url(#shield-fill)"
              stroke="#ffc900"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M30 68h16l7-17 11 32 7-15h19"
              fill="none"
              stroke="#fff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* statement */}
      <div className="relative px-14 pb-14 xl:px-20 xl:pb-16">
        <h2 className="max-w-lg text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.035em] xl:text-[2.5rem]">
          Şüpheli işlem, müşteriye <span className="text-tc-500">ulaşmadan</span> durur.
        </h2>
        <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          {PILLARS.map((pillar) => (
            <div key={pillar.title}>
              <dt className="text-sm font-medium text-white">{pillar.title}</dt>
              <dd className="mt-1 text-[13px] leading-snug text-night-300">{pillar.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
