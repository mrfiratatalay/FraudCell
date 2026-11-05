import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Activity, ArrowLeft, BrainCircuit, ShieldCheck, Zap } from 'lucide-react';
import { LogoWordmark } from '@/shared/ui/Logo';

/**
 * Kimlik akışı iskeleti — masaüstünde iki sütun.
 *
 * Sol: marka paneli (gradient + ürün vaadi), yalnızca lg ve üzeri görünür.
 * Sağ: form alanı. Mobilde sol panel gizlenir, üstte ince marka çubuğu kalır;
 * böylece küçük ekranda form tüm alanı alır (referans ekran 1'in ruhu).
 */

const HIGHLIGHTS = [
  { icon: BrainCircuit, title: 'Akıllı skor', desc: 'Saniyeler içinde' },
  { icon: ShieldCheck, title: 'Güvenli akış', desc: 'Uçtan uca koruma' },
  { icon: Zap, title: 'Canlı müdahale', desc: '7/24 operasyon' },
];

export function AuthScaffold({
  children,
  backTo,
}: {
  children: ReactNode;
  backTo?: '/auth';
}) {
  return (
    <div className="min-h-dvh w-full bg-canvas xl:grid xl:h-dvh xl:grid-cols-[clamp(34rem,43.75vw,52.5rem)_minmax(0,1fr)] xl:overflow-hidden">
      <aside className="relative hidden overflow-hidden gradient-splash xl:block">
        <div className="hero-mesh absolute inset-0" aria-hidden />
        <div className="brand-grid absolute inset-0 opacity-55" aria-hidden />
        <div className="absolute -right-24 -bottom-28 size-96 rounded-full border border-white/15" aria-hidden />
        <div className="absolute -right-8 -bottom-12 size-64 rounded-full border border-white/15" aria-hidden />

        <div className="scroll-slim relative z-10 flex h-full min-h-0 flex-col overflow-y-auto p-10 text-white 2xl:p-14">
          <div className="flex items-center justify-between gap-4">
            <LogoWordmark tone="white" />
            <span className="inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-white/80 uppercase backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-tc-500 shadow-[0_0_0_4px_rgba(255,201,0,.14)]" />
              Koruma aktif
            </span>
          </div>

          <div className="my-auto max-w-2xl py-[clamp(2rem,5vh,3.5rem)]">
            <p className="mb-[clamp(1rem,2.5vh,1.25rem)] text-xs font-bold tracking-[0.22em] text-aqua-300 uppercase">
              Turkcell güvenlik ağı
            </p>
            <h2 className="max-w-2xl text-[clamp(2.5rem,4vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.055em]">
              Dijital işlemler, <span className="text-tc-500">akıllı koruma</span> altında.
            </h2>
            <p className="mt-[clamp(1rem,2.8vh,1.5rem)] max-w-xl text-[clamp(1rem,1.25vw,1.125rem)] leading-relaxed text-white/72">
              FraudCell, işlemleri yapay zekâ ile izler; riski müşteriye ulaşmadan yakalar ve
              operasyon ekibine tek bir canlı akış sunar.
            </p>

            <div className="mt-[clamp(1.5rem,4vh,2.25rem)] grid grid-cols-3 gap-3">
              {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-card border border-white/12 bg-white/9 p-3.5 backdrop-blur-sm 2xl:p-4">
                  <span className="flex size-10 items-center justify-center rounded-tile bg-white/12 text-tc-500">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-4 text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-white/55">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-4 rounded-card border border-white/12 bg-brand-950/30 p-4 backdrop-blur-sm">
              <span className="flex size-11 items-center justify-center rounded-full bg-success-500/18 text-success-100 ring-1 ring-success-500/40">
                <Activity className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">Güvenlik motoru</span>
                  <span className="text-success-100">Çevrimiçi</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-aqua-500 to-tc-500" />
                </div>
              </div>
            </div>
          </div>

          <p className="shrink-0 text-xs tracking-wide text-white/50">TURKCELL CODENIGHT 2026 · FRAUDCELL</p>
        </div>
      </aside>

      <div className="relative flex min-h-dvh min-w-0 flex-col overflow-x-clip xl:min-h-0 xl:overflow-y-auto">
        <div className="pointer-events-none absolute -top-28 -right-28 size-80 rounded-full bg-aqua-100/45 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-32 size-80 rounded-full bg-tc-100/45 blur-3xl" aria-hidden />
        <header className="sticky top-0 z-20 flex h-18 shrink-0 items-center border-b border-white/70 bg-white/70 px-4 backdrop-blur-xl sm:h-20 sm:px-8 xl:hidden">
          {backTo ? (
            <Link
              to={backTo}
              aria-label="Giriş seçeneklerine dön"
              className="mr-3 rounded-full p-2 text-ink-500 transition-colors hover:bg-ink-100"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
          ) : null}
          <LogoWordmark />
        </header>

        {backTo ? (
          <div className="relative z-10 hidden shrink-0 px-8 pt-8 xl:block 2xl:px-12">
            <Link
              to={backTo}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 transition-colors hover:text-brand-700"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Giriş seçenekleri
            </Link>
          </div>
        ) : null}

        <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-7 sm:px-8 sm:py-10 xl:px-10 xl:py-8 2xl:px-14">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AuthFlow({
  titleId,
  icon,
  title,
  description,
  children,
}: {
  titleId: string;
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="flex w-full max-w-md flex-col md:min-h-[32rem]"
      aria-labelledby={titleId}
    >
      <div className="mb-5 text-center sm:mb-6">
        <span className="mx-auto flex size-12 items-center justify-center rounded-tile bg-brand-100 text-brand-700 ring-1 ring-brand-200/60 sm:size-14">
          {icon}
        </span>
        <h1 id={titleId} className="mt-3.5 text-h1 text-ink-900 sm:mt-4">
          {title}
        </h1>
        <p className="mx-auto mt-1.5 min-h-5 max-w-sm text-sm leading-5 text-ink-500 sm:mt-2">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}
