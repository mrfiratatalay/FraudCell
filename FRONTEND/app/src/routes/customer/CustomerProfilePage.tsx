import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { useCurrentUser } from '@/features/authentication/useSession';
import { logout } from '@/features/authentication/session';
import { listSessions, revokeSession } from '@/features/customer/api';
import { ROLE_LABEL } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { formatDateTime, fullName } from '@/shared/lib/format';
import {
  Avatar,
  Button,
  CustomerPageHeader,
  EmptyState,
  ErrorState,
  SkeletonList,
  ToneBadge,
  useToast,
} from '@/shared/ui';

export function CustomerProfilePage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const sessions = useQuery({ queryKey: queryKeys.sessions, queryFn: listSessions });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      toast.success('Oturum kapatıldı');
    },
    onError: (error) => toast.fromError(error),
  });

  const displayName = fullName(user.firstName, user.lastName) || 'FraudCell müşterisi';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <CustomerPageHeader
        title="Profil"
        description="Hesap bilgilerin ve hesabının açık olduğu cihazlar."
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:block">
        <section
          className="order-1 surface-panel overflow-hidden p-5"
          aria-labelledby="profile-title"
        >
          <div className="flex items-center gap-3">
            <Avatar name={displayName} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 id="profile-title" className="font-semibold text-ink-900">
                {displayName}
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">{user.gsmNumber ?? user.email}</p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-line border-t border-line text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-ink-500">Rol</dt>
              <dd className="font-medium text-ink-900">{ROLE_LABEL[user.role]}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-ink-500">Aktif cihaz</dt>
              <dd className="font-medium tabular text-ink-900">
                {sessions.isPending ? '—' : sessions.data?.length ?? 0}
              </dd>
            </div>
          </dl>
        </section>

          <section className="order-3 mt-4">
            <button
              type="button"
              onClick={() => {
                void logout().then(() => navigate({ to: '/auth', replace: true }));
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-control border border-line bg-surface text-sm font-medium text-critical-600 shadow-card transition-colors hover:bg-critical-100"
            >
              <LogOut className="size-4" aria-hidden />
              Çıkış yap
            </button>
          </section>
        </div>

        <section
          className="order-2 mt-7 lg:mt-0"
          aria-labelledby="sessions-title"
        >
          <div className="mb-4">
            <h2 id="sessions-title" className="text-h2 text-ink-900">Aktif cihazlar</h2>
            <p className="mt-1 text-[13px] text-ink-500">Tanımadığın bir cihaz varsa oturumunu kapat.</p>
          </div>
          {sessions.isPending ? <SkeletonList rows={2} /> : null}
          {sessions.isError ? (
            <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
          ) : null}
          {sessions.data?.length === 0 ? (
            <EmptyState icon={<Laptop />} title="Aktif cihaz bulunamadı" />
          ) : null}
          <div className={sessions.data?.length ? 'surface-panel divide-y divide-line overflow-hidden' : 'hidden'}>
            {sessions.data?.map((session) => (
              <article key={session.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 text-ink-400">
                  {session.userAgent?.toLocaleLowerCase('tr-TR').includes('mobile') ? (
                    <Smartphone className="size-5" aria-hidden />
                  ) : (
                    <Laptop className="size-5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink-900">
                      {session.isCurrent ? 'Bu cihaz' : 'Diğer cihaz'}
                    </p>
                    {session.isCurrent ? (
                      <ToneBadge toneClass="bg-success-100 text-success-700">Aktif</ToneBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words text-xs text-ink-500">
                    {session.userAgent ?? 'Cihaz bilgisi yok'}
                  </p>
                  <p className="mt-2 text-xs text-ink-400">
                    Son kullanım: {formatDateTime(session.lastUsedAt ?? session.createdAt)}
                  </p>
                </div>
                {!session.isCurrent ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={revoke.isPending && revoke.variables === session.id}
                    onClick={() => revoke.mutate(session.id)}
                  >
                    Kapat
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
