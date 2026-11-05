import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { requestOtp, verifyOtp } from '@/features/authentication/api';
import { fromOtpVerification, startSession } from '@/features/authentication/session';
import { HOME_BY_ROLE } from '@/app/router/guards';
import type { RequestOtpChallengeResponse } from '@/shared/api/contract';
import { messageFor } from '@/shared/api/errors';
import { Banner, Button, Field } from '@/shared/ui';
import { OtpInput } from '@/shared/ui/OtpInput';
import { AuthFlow, AuthScaffold } from './AuthScaffold';

const phoneSchema = z.object({
  gsmNumber: z
    .string()
    .trim()
    .regex(/^(?:\+?90|0)?5\d{9}$/, 'Geçerli bir cep telefonu numarası gir.'),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
});

type PhoneValues = z.infer<typeof phoneSchema>;
type Mode = 'login' | 'register';

function secondsUntil(value: string): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

export function CustomerOtpPage({
  mode,
  redirectTo,
}: {
  mode: Mode;
  redirectTo?: string;
}) {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<RequestOtpChallengeResponse | null>(null);
  const [phoneValues, setPhoneValues] = useState<PhoneValues | null>(null);
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PhoneValues>({
    resolver: zodResolver(
      phoneSchema.superRefine((values, context) => {
        if (mode !== 'register') return;
        if (!values.firstName.trim()) {
          context.addIssue({ code: 'custom', path: ['firstName'], message: 'Ad zorunludur.' });
        }
        if (!values.lastName.trim()) {
          context.addIssue({ code: 'custom', path: ['lastName'], message: 'Soyad zorunludur.' });
        }
        if (values.email.trim() && !z.string().email().safeParse(values.email.trim()).success) {
          context.addIssue({ code: 'custom', path: ['email'], message: 'Geçerli bir e-posta adresi gir.' });
        }
      }),
    ),
    defaultValues: { gsmNumber: '', firstName: '', lastName: '', email: '' },
  });

  useEffect(() => {
    if (!challenge) return;
    setSecondsLeft(secondsUntil(challenge.expiresAt));
    const timer = window.setInterval(
      () => setSecondsLeft(secondsUntil(challenge.expiresAt)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [challenge]);

  const submitPhone = handleSubmit(async (values) => {
    setRequestError(null);
    try {
      const response = await requestOtp({
        gsmNumber: values.gsmNumber,
        purpose: mode === 'register' ? 'CustomerRegister' : 'CustomerLogin',
      });
      setPhoneValues(values);
      setChallenge(response);
      setCode('');
    } catch (error) {
      setRequestError(messageFor(error));
    }
  });

  async function submitCode(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!challenge || !phoneValues || code.length !== 4 || secondsLeft === 0) return;

    setRequestError(null);
    setIsVerifying(true);
    try {
      const customer =
        mode === 'register'
          ? {
              firstName: phoneValues.firstName.trim(),
              lastName: phoneValues.lastName.trim(),
              email: phoneValues.email.trim() || null,
            }
          : undefined;
      const response = await verifyOtp({
        challengeId: challenge.challengeId,
        code,
        customer: customer ?? null,
      });
      startSession(response.accessToken, fromOtpVerification(response.user));
      await navigate({
        to: redirectTo ?? HOME_BY_ROLE[response.user.role],
        replace: true,
      });
    } catch (error) {
      setRequestError(messageFor(error));
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <AuthScaffold tab="customer">
      <AuthFlow
        titleId="customer-auth-title"
        title={challenge ? 'Doğrulama kodu' : mode === 'register' ? 'Müşteri kaydı' : 'Müşteri girişi'}
        description={
          challenge
            ? `${challenge.maskedGsmNumber} numarasına gönderilen 4 haneli kodu gir.`
            : mode === 'register'
              ? 'Telefon numaranla hesabını birkaç saniyede oluştur.'
              : 'Cep telefonu numarana tek kullanımlık kod gönderelim.'
        }
      >

        {!challenge ? (
          <form onSubmit={submitPhone} className="space-y-5" noValidate>
            {requestError ? <Banner tone="danger">{requestError}</Banner> : null}
            <Field
              label="Cep telefonu"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              leadingIcon={<Phone className="size-5" />}
              error={errors.gsmNumber?.message}
              {...register('gsmNumber')}
            />

            {mode === 'register' ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ad" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
                  <Field label="Soyad" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} />
                </div>
                <Field
                  label="E-posta (isteğe bağlı)"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </>
            ) : null}

            <Button type="submit" size="lg" fullWidth loading={isSubmitting} className="!mt-7">
              Kod gönder
            </Button>
            <p className="text-center text-[13px] text-ink-500">
              {mode === 'register' ? (
                <>
                  Zaten müşteri misin?{' '}
                  <Link to="/auth" className="font-medium text-brand-700 hover:underline">
                    Giriş yap
                  </Link>
                </>
              ) : (
                <>
                  Hesabın yok mu?{' '}
                  <Link to="/auth/otp" search={{ mode: 'register' }} className="font-medium text-brand-700 hover:underline">
                    Yeni müşteri kaydı
                  </Link>
                </>
              )}
            </p>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-5">
            {requestError ? <Banner tone="danger">{requestError}</Banner> : null}
            {challenge.demoHint ? <Banner tone="info">{challenge.demoHint}</Banner> : null}

            <div className="flex justify-start">
              <OtpInput value={code} onChange={setCode} length={4} disabled={isVerifying} autoFocus />
            </div>
            <p className="text-[13px] text-ink-500 tabular">
              {secondsLeft > 0 ? `Kod ${secondsLeft} saniye geçerli.` : 'Kodun süresi doldu.'}
            </p>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={isVerifying}
              disabled={code.length !== 4 || secondsLeft === 0}
            >
              Doğrula
            </Button>
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setPhoneValues(null);
                setCode('');
                setRequestError(null);
              }}
              className="block w-full text-center text-[13px] font-medium text-ink-500 hover:text-ink-900"
            >
              Telefon numarasını değiştir
            </button>
          </form>
        )}
      </AuthFlow>
    </AuthScaffold>
  );
}
