import { Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail } from 'lucide-react';
import { Banner, Button, Field, PasswordField } from '@/shared/ui';
import { LogoWordmark } from '@/shared/ui/Logo';
import { ERROR_CODES, isApiError, messageFor } from '@/shared/api/errors';
import { useStaffLogin } from '@/features/authentication/hooks';

/**
 * Personel girişi.
 *
 * Müşteri akışından farklı bir yüzey: analist/süpervizör/yönetici masaüstünde
 * çalışıyor, o yüzden gradient splash yerine sade beyaz kart.
 *
 * Hesap kilidi (`ACCOUNT_LOCKED`) ayrı bir durum olarak gösterilir — "şifre
 * yanlış" demek yanıltıcı olurdu, kullanıcı denemeye devam ederdi.
 */

const schema = z.object({
  email: z.email('Geçerli bir e-posta gir.'),
  password: z.string().min(1, 'Şifreni gir.'),
});

type Values = z.infer<typeof schema>;

export function StaffLogin() {
  const login = useStaffLogin();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const locked =
    isApiError(login.error) && login.error.is(ERROR_CODES.ACCOUNT_LOCKED);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <LogoWordmark />
        </div>

        <div className="surface-card p-6">
          <h1 className="text-xl font-bold text-ink-900">Personel Girişi</h1>
          <p className="mt-1 text-sm text-ink-500">
            Analist, süpervizör ve yönetici hesapları için.
          </p>

          {locked ? (
            <Banner tone="danger" className="mt-5">
              <p className="font-semibold">Hesabın kilitlendi</p>
              <p className="mt-0.5">
                Çok sayıda hatalı giriş denemesi yapıldı. Kilidin açılması için yöneticinle
                iletişime geç.
              </p>
            </Banner>
          ) : (
            login.error && (
              <Banner tone="danger" className="mt-5">
                {messageFor(login.error)}
              </Banner>
            )
          )}

          <form
            onSubmit={form.handleSubmit((values) => login.mutate(values))}
            className="mt-5 space-y-4"
          >
            <Field
              label="E-posta"
              type="email"
              autoComplete="username"
              autoFocus
              disabled={locked}
              leadingIcon={<Mail className="size-5" />}
              {...form.register('email')}
              {...(form.formState.errors.email
                ? { error: form.formState.errors.email.message }
                : {})}
            />

            <PasswordField
              label="Şifre"
              autoComplete="current-password"
              disabled={locked}
              leadingIcon={<Lock className="size-5" />}
              {...form.register('password')}
              {...(form.formState.errors.password
                ? { error: form.formState.errors.password.message }
                : {})}
            />

            <Button type="submit" fullWidth size="lg" loading={login.isPending} disabled={locked}>
              Giriş Yap
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Müşteri misin?{' '}
          <Link to="/auth" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
            Müşteri girişine dön
          </Link>
        </p>
      </div>
    </div>
  );
}
