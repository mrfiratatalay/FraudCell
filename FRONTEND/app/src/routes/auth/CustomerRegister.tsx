import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, User } from 'lucide-react';
import { Field } from '@/shared/ui';
import { messageFor } from '@/shared/api/errors';
import type { RequestOtpChallengeResponse, VerifyOtpCustomerInfo } from '@/shared/api/contract';
import { useRequestOtp, useVerifyOtp } from '@/features/authentication/hooks';
import { AuthShell, AuthSubmit } from './AuthShell';
import { PhoneStep } from './PhoneStep';
import { OtpStep } from './OtpStep';

/**
 * Müşteri kaydı: telefon → ad/soyad → OTP.
 *
 * Ad/soyad OTP'DEN ÖNCE toplanıyor çünkü backend bu bilgiyi doğrulama
 * isteğinin gövdesinde bekliyor (`purpose=CustomerRegister` iken `customer`
 * alanı zorunlu). Ayrı bir `/register` ucu yok — kayıt, doğrulamanın kendisiyle
 * aynı çağrıda tamamlanıyor.
 */

const infoSchema = z.object({
  firstName: z.string().trim().min(2, 'Adını gir.').max(50, 'Ad en fazla 50 karakter olabilir.'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Soyadını gir.')
    .max(50, 'Soyad en fazla 50 karakter olabilir.'),
  email: z.union([z.literal(''), z.email('Geçerli bir e-posta gir.')]).optional(),
});

type InfoValues = z.infer<typeof infoSchema>;

type Step = 'phone' | 'info' | 'otp';

export function CustomerRegister() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('phone');
  const [gsmNumber, setGsmNumber] = useState('');
  const [customer, setCustomer] = useState<VerifyOtpCustomerInfo | null>(null);
  const [challenge, setChallenge] = useState<RequestOtpChallengeResponse | null>(null);

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const form = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: { firstName: '', lastName: '', email: '' },
  });

  /* ---------------------------------------------------------- 1. telefon -- */

  if (step === 'phone') {
    return (
      <AuthShell
        title="Hesap Oluştur"
        description="Telefon numaranı gir, hesabını birlikte kuralım."
        onBack={() => void navigate({ to: '/auth' })}
      >
        <PhoneStep
          onSubmit={(raw) => {
            setGsmNumber(raw);
            setStep('info');
          }}
          loading={false}
        />
      </AuthShell>
    );
  }

  /* ------------------------------------------------------ 2. ad / soyad -- */

  if (step === 'info') {
    const submitInfo = form.handleSubmit((values) => {
      const info: VerifyOtpCustomerInfo = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email?.trim() ? values.email.trim() : null,
      };
      setCustomer(info);

      // Bilgiler alındıktan sonra OTP gönderilir; doğrulama ikisini birlikte
      // gönderecek.
      requestOtp.mutate(
        { gsmNumber, purpose: 'CustomerRegister' },
        {
          onSuccess: (next) => {
            setChallenge(next);
            setStep('otp');
          },
        },
      );
    });

    return (
      <AuthShell
        title="Seni Tanıyalım"
        description="Hesabında görünecek bilgiler."
        onBack={() => setStep('phone')}
      >
        <form onSubmit={submitInfo} className="flex min-h-[50vh] flex-col gap-4">
          <Field
            label="Ad"
            onBrand
            autoFocus
            autoComplete="given-name"
            leadingIcon={<User className="size-5" />}
            {...form.register('firstName')}
            {...(form.formState.errors.firstName
              ? { error: form.formState.errors.firstName.message }
              : {})}
          />

          <Field
            label="Soyad"
            onBrand
            autoComplete="family-name"
            leadingIcon={<User className="size-5" />}
            {...form.register('lastName')}
            {...(form.formState.errors.lastName
              ? { error: form.formState.errors.lastName.message }
              : {})}
          />

          <Field
            label="E-posta (isteğe bağlı)"
            onBrand
            type="email"
            autoComplete="email"
            leadingIcon={<Mail className="size-5" />}
            {...form.register('email')}
            {...(form.formState.errors.email
              ? { error: form.formState.errors.email.message }
              : {})}
          />

          {requestOtp.error && (
            <p role="alert" className="text-center text-sm font-medium text-white">
              <span className="rounded-pill bg-danger-500 px-3 py-1.5">
                {messageFor(requestOtp.error)}
              </span>
            </p>
          )}

          <div className="mt-auto pt-8">
            <AuthSubmit loading={requestOtp.isPending}>Devam Et</AuthSubmit>
          </div>
        </form>
      </AuthShell>
    );
  }

  /* ------------------------------------------------------------- 3. OTP -- */

  if (!challenge || !customer) return null;

  return (
    <AuthShell title="Doğrulama Kodu" onBack={() => setStep('info')}>
      <OtpStep
        maskedNumber={challenge.maskedGsmNumber}
        expiresAt={challenge.expiresAt}
        demoHint={challenge.demoHint}
        loading={verifyOtp.isPending}
        resending={requestOtp.isPending}
        // Kayıtta müşteri bilgisi doğrulama gövdesinde GİDER.
        onSubmit={(code) =>
          verifyOtp.mutate({ challengeId: challenge.challengeId, code, customer })
        }
        onResend={() =>
          requestOtp.mutate(
            { gsmNumber, purpose: 'CustomerRegister' },
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
          Bu numara zaten kayıtlıysa{' '}
          <button
            type="button"
            onClick={() => void navigate({ to: '/auth/login' })}
            className="font-semibold text-white underline underline-offset-4"
          >
            giriş yap
          </button>
        </p>
      )}
    </AuthShell>
  );
}
