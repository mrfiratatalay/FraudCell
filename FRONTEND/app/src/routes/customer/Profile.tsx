import { useQuery } from '@tanstack/react-query';
import { LogOut, Mail, Monitor, Phone, Shield, User } from 'lucide-react';
import { api } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import type { SessionResponse } from '@/shared/api/contract';
import { Button, Card, ErrorState, SectionTitle, Skeleton, ToneBadge } from '@/shared/ui';
import { formatDateTime, formatRelative, fullName, initials } from '@/shared/lib/format';
import { ROLE_LABEL } from '@/shared/api/enums';
import { logout } from '@/features/authentication/session';
import { useCurrentUser } from '@/features/authentication/useSession';

/**
 * Profil ve güvenlik.
 *
 * Aktif oturumlar burada listeleniyor: kullanıcı tanımadığı bir cihaz
 * görürse hesabının ele geçirildiğini fark edebilmeli.
 */
export function CustomerProfile() {
  const user = useCurrentUser();

  const sessions = useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () =>
      api.get<SessionResponse[]>(endpoints.auth.sessions).then((r) => r.data),
  });

  const name = fullName(user.firstName, user.lastName) || 'Müşteri';

  return (
    <div className="px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-ink-900">Profil</h1>

      {/* --------------------------------------------------------- kimlik -- */}
      <Card className="flex items-center gap-4">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800"
          aria-hidden
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-ink-900">{name}</p>
          <ToneBadge toneClass="bg-brand-100 text-brand-800" className="mt-1">
            {ROLE_LABEL[user.role]}
          </ToneBadge>
        </div>
      </Card>

      {/* -------------------------------------------------------- iletişim -- */}
      <section className="mt-6">
        <SectionTitle>Hesap Bilgileri</SectionTitle>
        <Card className="divide-y divide-ink-100">
          <InfoRow
            icon={<Phone className="size-5" />}
            label="Telefon"
            value={user.gsmNumber ?? '—'}
          />
          <InfoRow
            icon={<Mail className="size-5" />}
            label="E-posta"
            value={user.email ?? 'Eklenmemiş'}
          />
          <InfoRow
            icon={<User className="size-5" />}
            label="Müşteri no"
            value={<span className="font-mono text-sm">{user.id}</span>}
          />
        </Card>
      </section>

      {/* ------------------------------------------------------- oturumlar -- */}
      <section className="mt-6">
        <SectionTitle>Aktif Oturumlar</SectionTitle>

        {sessions.isPending ? (
          <Card className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </Card>
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <Card className="divide-y divide-ink-100">
            {(sessions.data ?? []).map((s) => (
              <div key={s.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-ink-100 text-ink-500"
                  aria-hidden
                >
                  <Monitor className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-ink-900">
                      {s.createdIp ?? 'Bilinmeyen konum'}
                    </p>
                    {s.isCurrent && (
                      <ToneBadge toneClass="bg-success-100 text-success-700">
                        Bu cihaz
                      </ToneBadge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-500">
                    {s.userAgent ?? 'Bilinmeyen cihaz'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Son kullanım:{' '}
                    {s.lastUsedAt ? formatRelative(s.lastUsedAt) : formatDateTime(s.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* -------------------------------------------------------- güvenlik -- */}
      <section className="mt-6">
        <SectionTitle>Güvenlik</SectionTitle>
        <Card className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-success-100 text-success-700"
            aria-hidden
          >
            <Shield className="size-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-700">
            Hesabına yalnızca SMS doğrulamasıyla giriş yapılabilir. Şifre kullanılmadığı
            için şifre çalınması riski yoktur.
          </p>
        </Card>
      </section>

      <Button
        variant="danger"
        fullWidth
        size="lg"
        className="mt-6"
        leadingIcon={<LogOut className="size-4" />}
        onClick={() => void logout()}
      >
        Çıkış Yap
      </Button>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="text-ink-400" aria-hidden>
        {icon}
      </span>
      <span className="flex-1 text-sm text-ink-500">{label}</span>
      <span className="min-w-0 truncate text-[15px] font-medium text-ink-900">{value}</span>
    </div>
  );
}
