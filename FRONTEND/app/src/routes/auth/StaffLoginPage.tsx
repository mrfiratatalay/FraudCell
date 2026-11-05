import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { loginStaff } from '@/features/authentication/api';
import { fromStaffLogin, startSession } from '@/features/authentication/session';
import { HOME_BY_ROLE } from '@/app/router/guards';
import { messageFor } from '@/shared/api/errors';
import { Banner, Button, Field, PasswordField } from '@/shared/ui';
import { AuthFlow, AuthScaffold } from './AuthScaffold';

const schema = z.object({
  email: z.string().trim().email('Geçerli bir e-posta adresi gir.'),
  password: z.string().min(1, 'Şifre zorunludur.'),
});

type FormValues = z.infer<typeof schema>;

export function StaffLoginPage({ redirectTo }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRequestError(null);
    try {
      const response = await loginStaff(values);
      startSession(
        response.accessToken,
        fromStaffLogin(response.user, values.email.trim().toLowerCase()),
      );
      await navigate({
        to: redirectTo ?? HOME_BY_ROLE[response.user.role],
        replace: true,
      });
    } catch (error) {
      setRequestError(messageFor(error));
    }
  });

  return (
    <AuthScaffold tab="staff">
      <AuthFlow
        titleId="staff-login-title"
        title="Personel girişi"
        description="Analist, süpervizör ve yönetici hesapları için."
      >
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {requestError ? <Banner tone="danger">{requestError}</Banner> : null}

          <Field
            label="E-posta"
            type="email"
            autoComplete="username"
            inputMode="email"
            leadingIcon={<Mail className="size-5" />}
            error={errors.email?.message}
            {...register('email')}
          />
          <PasswordField
            label="Şifre"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" size="lg" fullWidth loading={isSubmitting} className="!mt-7">
            Giriş yap
          </Button>
        </form>
      </AuthFlow>
    </AuthScaffold>
  );
}
