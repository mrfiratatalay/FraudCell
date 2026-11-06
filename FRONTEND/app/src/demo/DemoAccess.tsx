import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, Loader2 } from 'lucide-react';
import { HOME_BY_ROLE } from '@/app/router/guards';
import { loginStaff, requestOtp, verifyOtp } from '@/features/authentication/api';
import { fromOtpVerification, fromStaffLogin, startSession } from '@/features/authentication/session';
import type { Role } from '@/shared/api/enums';
import { cn } from '@/shared/lib/cn';

const PERSONAS: { role: Role; title: string; name: string; does: string; email?: string }[] = [
  { role: 'CUSTOMER', title: 'Müşteri', name: 'Ahmet Yılmaz', does: 'İşlem yapar, "ben miydim?" sorusunu yanıtlar' },
  { role: 'ANALYST', title: 'Analist', name: 'Deniz Kaya', does: 'Vakayı inceler, onaylar ya da bloklar', email: 'deniz.kaya@fraudcell.demo' },
  { role: 'SUPERVISOR', title: 'Süpervizör', name: 'Murat Demir', does: 'Kuyruğu atar, SLA ve modeli izler', email: 'murat.demir@fraudcell.demo' },
  { role: 'ADMIN', title: 'Yönetici', name: 'Selin Aydın', does: 'Personel ve yetkileri yönetir', email: 'selin.aydin@fraudcell.demo' },
];

/** One-click, password-free sign-in for every role. Shown only in the demo build. */
export default function DemoAccess() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Role | null>(null);

  async function enter(persona: (typeof PERSONAS)[number]) {
    setBusy(persona.role);
    try {
      if (persona.email) {
        const res = await loginStaff({ email: persona.email, password: 'Demo1234!' });
        startSession(res.accessToken, fromStaffLogin(res.user, persona.email));
      } else {
        const challenge = await requestOtp({ gsmNumber: '05551234567', purpose: 'CustomerLogin' });
        const res = await verifyOtp({ challengeId: challenge.challengeId, code: '1234', customer: null });
        startSession(res.accessToken, fromOtpVerification(res.user));
      }
      await navigate({ to: HOME_BY_ROLE[persona.role], replace: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="demo-access-title" className="mb-8 rounded-card border border-tc-500/40 bg-tc-50 p-4">
      <h2 id="demo-access-title" className="text-sm font-semibold text-ink-900">
        Demo: tek tıkla, şifresiz gir
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-600">Her rol ayrı bir ekran; aynı vakaları dört taraftan görürsün.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {PERSONAS.map((persona) => (
          <button
            key={persona.role}
            type="button"
            disabled={busy !== null}
            onClick={() => void enter(persona)}
            aria-label={`${persona.title} olarak gir`}
            className={cn(
              'group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left shadow-card transition-colors',
              'hover:border-ink-300 disabled:opacity-60',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink-900">{persona.title}</span>
              <span className="block truncate text-xs text-ink-500" title={persona.does}>{persona.name}</span>
            </span>
            {busy === persona.role ? (
              <Loader2 className="size-4 animate-spin text-ink-500" aria-hidden />
            ) : (
              <ArrowRight className="size-4 text-ink-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
