import { useEffect, useState } from 'react';
import { OtpInput } from '@/shared/ui/OtpInput';
import { formatCountdown } from '@/shared/lib/format';
import { AuthSubmit } from './AuthShell';

/**
 * OTP kodu adımı.
 *
 * Kod 6 hane olunca otomatik gönderilir; kullanıcı ayrıca butona basmak
 * zorunda kalmaz. Buton yine de duruyor — otomatik gönderim başarısız olursa
 * (yanlış kod) tekrar denemek için gerekli.
 */
export function OtpStep({
  maskedNumber,
  expiresAt,
  demoHint,
  onSubmit,
  onResend,
  loading,
  resending,
  error,
}: {
  maskedNumber: string;
  /** ISO tarih — geri sayım bunun üzerinden işler. */
  expiresAt: string;
  /** Demo profilinde backend'in gönderdiği ipucu; üretimde null gelir. */
  demoHint: string | null;
  onSubmit: (code: string) => void;
  onResend: () => void;
  loading: boolean;
  resending: boolean;
  error?: string;
}) {
  const [code, setCode] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Yeni kod istendiğinde eski girdiyi temizle.
  useEffect(() => {
    setCode('');
  }, [expiresAt]);

  const remaining = new Date(expiresAt).getTime() - now;
  const expired = remaining <= 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onSubmit(code);
      }}
      className="flex min-h-[50vh] flex-col"
    >
      <p className="mb-6 text-center text-[15px] text-white/80">
        <span className="font-semibold text-white">{maskedNumber}</span> numarasına gönderilen
        6 haneli kodu gir.
      </p>

      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={onSubmit}
        disabled={loading || expired}
        error={Boolean(error)}
        autoFocus
      />

      {error && (
        <p role="alert" className="mt-4 text-center text-sm font-medium text-white">
          <span className="rounded-pill bg-danger-500 px-3 py-1.5">{error}</span>
        </p>
      )}

      <div className="mt-6 text-center">
        {expired ? (
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="text-[15px] font-semibold text-white underline-offset-4 hover:underline disabled:opacity-60"
          >
            {resending ? 'Gönderiliyor…' : 'Yeni kod gönder'}
          </button>
        ) : (
          <p className="text-sm text-white/70">
            Kalan süre <span className="font-semibold tabular text-white">{formatCountdown(remaining)}</span>
          </p>
        )}
      </div>

      {demoHint && (
        <p className="mt-6 rounded-card bg-white/15 px-4 py-2.5 text-center text-sm text-white">
          {demoHint}
        </p>
      )}

      <div className="mt-auto pt-8">
        <AuthSubmit loading={loading} disabled={code.length !== 6 || expired}>
          Doğrula
        </AuthSubmit>
      </div>
    </form>
  );
}
