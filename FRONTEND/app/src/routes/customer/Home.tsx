import { Link } from '@tanstack/react-router';
import { ArrowRight, Plus, Receipt, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Banner, Button, EmptyState, ErrorState, SectionTitle, SkeletonList } from '@/shared/ui';
import { LogoMark } from '@/shared/ui/Logo';
import { fullName } from '@/shared/lib/format';
import { useCurrentUser } from '@/features/authentication/useSession';
import { useTransactions } from '@/features/transactions/hooks';
import { usePendingVerifications } from '@/features/verifications/hooks';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';

/**
 * Müşteri ana sayfası.
 *
 * Üstte tasarımdaki gradient blok, altında bekleyen doğrulama uyarısı ve son
 * işlemler. Bekleyen doğrulama en üstte duruyor çünkü kullanıcıdan EYLEM
 * bekleyen tek şey o (UX-CUS-004/005).
 */
export function CustomerHome() {
  const user = useCurrentUser();
  const transactions = useTransactions({ limit: 5 });
  const pending = usePendingVerifications();

  const recent = transactions.data?.pages[0]?.items ?? [];
  const pendingCount = pending.data?.length ?? 0;

  return (
    <div>
      {/* --------------------------------------------------- gradient blok -- */}
      <header className="gradient-header px-4 pt-8 pb-16 text-white safe-top lg:rounded-b-card">
        <div className="flex items-center gap-3">
          <LogoMark className="size-9 text-white lg:hidden" />
          <div className="min-w-0">
            <p className="text-sm text-white/75">Hoş geldin</p>
            <h1 className="truncate text-xl font-bold">
              {fullName(user.firstName, user.lastName) || 'Müşteri'}
            </h1>
          </div>
        </div>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
          İşlemlerin yapay zekâ destekli dolandırıcılık koruması altında izleniyor.
        </p>
      </header>

      {/* Gradient bloğun üzerine binen eylem kartı. */}
      <div className="-mt-10 px-4">
        <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink-900">Yeni işlem başlat</p>
            <p className="mt-0.5 text-sm text-ink-500">
              Ödeme, transfer, fatura veya çekim.
            </p>
          </div>
          <Link to="/customer/transactions/new" className="shrink-0">
            <Button leadingIcon={<Plus className="size-4" />} fullWidth>
              İşlem Oluştur
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-6 px-4 py-6">
        {/* ------------------------------------------ bekleyen doğrulama -- */}
        {pendingCount > 0 && (
          <Banner
            tone="warning"
            action={
              <Link to="/customer/verifications" className="shrink-0">
                <Button size="sm" variant="secondary">
                  Yanıtla
                </Button>
              </Link>
            }
          >
            <p className="font-semibold">
              {pendingCount} işlem için doğrulaman bekleniyor
            </p>
            <p className="mt-0.5">
              Şüpheli görünen işlemleri senin onayın olmadan tamamlamıyoruz.
            </p>
          </Banner>
        )}

        {/* ------------------------------------------------ son işlemler -- */}
        <section>
          <SectionTitle
            action={
              <Link
                to="/customer/transactions"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
              >
                Tümü
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          >
            Son İşlemler
          </SectionTitle>

          {transactions.isPending ? (
            <SkeletonList rows={3} />
          ) : transactions.isError ? (
            <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Receipt />}
              title="Henüz işlemin yok"
              description="İlk işlemini oluşturduğunda burada görünecek."
              action={
                <Link to="/customer/transactions/new">
                  <Button leadingIcon={<Plus className="size-4" />}>İşlem Oluştur</Button>
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {recent.map((tx) => (
                <li key={tx.transactionId}>
                  <TransactionRow tx={tx} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* -------------------------------------------------- güvenlik -- */}
        <section className="surface-card flex items-start gap-3 p-4">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-tile bg-success-100 text-success-700"
            aria-hidden
          >
            {pendingCount > 0 ? (
              <ShieldAlert className="size-5" />
            ) : (
              <ShieldCheck className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink-900">Hesap güvenliğin</p>
            <p className="mt-0.5 text-sm text-ink-500">
              {pendingCount > 0
                ? 'Bekleyen doğrulaman var. Yanıtlaman güvenliğini artırır.'
                : 'Şu an bekleyen bir güvenlik uyarın yok.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
