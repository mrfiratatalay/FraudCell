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
          ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgba(16,20,28,.12)] ring-1 ring-line'
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

/* --------------------------------------------------------- product still -- */

const STEPS = [
  { time: '03:12:04', title: 'İşlem alındı', detail: 'Transfer · ₺50.000 · New York, US' },
  { time: '03:12:04', title: 'AI skoru 0,94', detail: 'Çalıntı kart · karar: inceleme' },
  { time: '03:12:05', title: 'Vaka açıldı', detail: 'Öncelik kritik · SLA 15 dk' },
  { time: '03:12:05', title: 'Analiste atandı', detail: 'Uzmanlık ve bölge eşleşti' },
];

const SIGNALS = ['İlk kez görülen cihaz', 'Normal tutarın 10 katı', 'Alışılmadık konum', 'Gece saatinde işlem'];

function ProductStill() {
  return (
    <aside
      aria-hidden
      className="on-night relative hidden overflow-hidden gradient-splash text-white lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20"
    >
      <div className="brand-grid absolute inset-0 [mask-image:radial-gradient(70%_60%_at_60%_40%,black,transparent)]" />

      <div className="relative mx-auto w-full max-w-[520px]">
        <p className="text-[13px] font-medium text-[#a5adfb]">Gerçek zamanlı dolandırıcılık tespiti</p>
        <h2 className="mt-3 text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.035em] xl:text-[2.6rem]">
          Şüpheli işlem, müşteriye ulaşmadan durur.
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-night-300">
          Her işlem saniyeler içinde skorlanır; riskli olanlar SLA sayacıyla doğru analiste düşer.
        </p>

        <div className="relative mt-10">
          {/* Case card */}
          <div className="relative z-10 rounded-xl border border-white/10 bg-night-800/90 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[13px] text-night-300">TRX-2026-000142</span>
                <span className="inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium text-[#ff8aa8] ring-1 ring-[#ff8aa8]/30 ring-inset bg-[#361019]">
                  Kritik
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[#f6c459]">
                <span className="size-1.5 rounded-full bg-[#f6c459]" />
                SLA 14:32
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em] tabular">₺50.000,00</p>
                <p className="mt-2 text-[13px] text-night-300">Yurt dışı transfer · Çalıntı kart şüphesi</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-night-300">Risk skoru</p>
                <p className="font-mono text-2xl font-medium text-[#ff8aa8]">0,94</p>
              </div>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-[#e8a10c] via-[#f46a2a] to-[#ee3562]" />
            </div>

            <ul className="mt-4 flex flex-wrap gap-1.5">
              {SIGNALS.map((signal) => (
                <li key={signal} className="rounded-md bg-white/6 px-2 py-1 text-[12px] text-white/80 ring-1 ring-white/8">
                  {signal}
                </li>
              ))}
            </ul>
          </div>

          {/* Pipeline */}
          <ol className="relative mt-4 ml-5 rounded-xl border border-white/8 bg-night-900/70 p-5 backdrop-blur">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative flex gap-4 pb-4 last:pb-0">
                {index < STEPS.length - 1 && <span className="absolute top-4 left-[5px] h-full w-px bg-white/10" />}
                <span
                  className={cn(
                    'relative mt-1.5 size-[11px] shrink-0 rounded-full border-2',
                    index === STEPS.length - 1 ? 'border-[#22d3ee] bg-[#22d3ee]/20' : 'border-white/25 bg-night-900',
                  )}
                />
                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white">{step.title}</p>
                    <p className="text-[12px] text-night-300">{step.detail}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-white/40">{step.time}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  );
}
