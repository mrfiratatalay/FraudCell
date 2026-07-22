import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { messageFor } from '@/shared/api/errors';
import type { RequestOtpChallengeResponse } from '@/shared/api/contract';
import { useRequestOtp, useVerifyOtp } from '@/features/authentication/hooks';
import { AuthShell } from './AuthShell';
import { PhoneStep } from './PhoneStep';
import { OtpStep } from './OtpStep';

/**
 * Müşteri girişi: telefon → OTP.
 *
 * `purpose: 'CustomerLogin'` gönderilir. Numara kayıtlı değilse backend
 * KASITLI olarak "kod hatalı" der, "numara kayıtlı değil" demez — aksi hâlde
 * kayıtlı numaralar tek tek denenerek çıkarılabilirdi. Bu yüzden ekran
 * kullanıcıyı kayıt akışına otomatik yönlendiremez; hata mesajının altında
 * kayıt bağlantısı gösteriyoruz.
 */
export function CustomerLogin() {
  const navigate = useNavigate();

  /**
   * Ham numara ayrıca saklanıyor: challenge yanıtındaki `maskedGsmNumber`
   * ("555 *** ** 12") yeniden kod istemek için kullanılamaz.
   */
  const [gsmNumber, setGsmNumber] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<RequestOtpChallengeResponse | null>(null);

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const startChallenge = (raw: string) => {
    setGsmNumber(raw);
    requestOtp.mutate({ gsmNumber: raw, purpose: 'CustomerLogin' }, { onSuccess: setChallenge });
  };

  if (!challenge || !gsmNumber) {
    return (
      <AuthShell
        title="Tekrar Hoş Geldin"
        description="Telefon numaranı gir, sana bir doğrulama kodu gönderelim."
        onBack={() => void navigate({ to: '/auth' })}
      >
        <PhoneStep
          onSubmit={startChallenge}
          loading={requestOtp.isPending}
          {...(requestOtp.error ? { error: messageFor(requestOtp.error) } : {})}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Doğrulama Kodu"
      onBack={() => {
        setChallenge(null);
        verifyOtp.reset();
      }}
    >
      <OtpStep
        maskedNumber={challenge.maskedGsmNumber}
        expiresAt={challenge.expiresAt}
        demoHint={challenge.demoHint}
        loading={verifyOtp.isPending}
        resending={requestOtp.isPending}
        onSubmit={(code) => verifyOtp.mutate({ challengeId: challenge.challengeId, code })}
        onResend={() =>
          requestOtp.mutate(
            { gsmNumber, purpose: 'CustomerLogin' },
            {
              onSuccess: (next) => {
                setChallenge(next);
                verifyOtp.reset();
              },
            },
          )
        }
        {...(verifyOtp.error ? { error: messageFor(verifyOtp.error) } : {})}
      />

      {verifyOtp.error && (
        <p className="mt-6 text-center text-sm text-white/80">
          Hesabın yok mu?{' '}
          <button
            type="button"
            onClick={() => void navigate({ to: '/auth/register' })}
            className="font-semibold text-white underline underline-offset-4"
          >
            Kayıt ol
          </button>
        </p>
      )}
    </AuthShell>
  );
}
