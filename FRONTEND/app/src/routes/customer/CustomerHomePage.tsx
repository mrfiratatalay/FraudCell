import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { customerStatus, TransactionList } from '@/features/transactions/TransactionList';
import { useSession } from '@/features/authentication/useSession';
import { listTransactions } from '@/features/transactions/api';
import { listPendingVerifications } from '@/features/customer/api';
import { queryKeys } from '@/shared/api/query-keys';
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui';

export function CustomerHomePage() {
  const { user } = useSession();
  const transactions = useQuery({
    queryKey: queryKeys.transactions.list({ limit: 5 }),
    queryFn: () => listTransactions({ limit: 5 }),
  });
  const verifications = useQuery({
    queryKey: queryKeys.pendingVerifications,
    queryFn: listPendingVerifications,
  });

  const pendingCount = verifications.data?.length ?? 0;
  const items = transactions.data?.items ?? [];
  const inReview = items.filter((item) => customerStatus(item).label === 'İncelemede').length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-ink-500">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 text-h1 text-ink-900 sm:text-[1.75rem]">Merhaba, {user?.firstName ?? 'hoş geldin'}</h1>
        </div>
        <Link
          to="/customer/transactions/new"
          className="inline-flex h-10 items-center gap-2 rounded-control bg-tc-500 px-4 text-sm font-semibold text-night-900 transition-colors hover:bg-tc-400 lg:hidden"
        >
          <Plus className="size-4" aria-hidden />
          Yeni işlem
        </Link>
      </header>

      {pendingCount > 0 ? (
        <section
          aria-labelledby="pending-title"
          className="mt-6 flex flex-wrap items-center gap-4 rounded-card border border-warning-500/30 bg-warning-100 p-4 sm:p-5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white">
            <ShieldAlert className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="pending-title" className="text-sm font-semibold text-warning-700">
              {pendingCount === 1 ? 'Bir işlem senin onayını bekliyor' : `${pendingCount} işlem senin onayını bekliyor`}
            </h2>
            <p className="mt-0.5 text-[13px] text-warning-700/90">
              Sen yapmadıysan hemen bildir; işlem sen yanıtlayana kadar beklemede.
            </p>
          </div>
          <Link
            to="/customer/verifications"
            className="inline-flex h-9 items-center gap-1.5 rounded-control bg-ink-900 px-3.5 text-[13px] font-medium text-surface transition-opacity hover:opacity-90"
          >
            Yanıtla <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section aria-labelledby="recent-title">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 id="recent-title" className="text-h2 text-ink-900">
              Son işlemler
            </h2>
            <Link to="/customer/transactions" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
              Tümü <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {transactions.isPending ? <SkeletonList rows={4} /> : null}
          {transactions.isError ? <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} /> : null}
          {transactions.isSuccess && items.length === 0 ? (
            <div className="surface-panel">
              <EmptyState
                illustration="transactions"
                title="Henüz işlem yok"
                description="İlk işlemini yaptığında burada durumuyla birlikte görünür."
              />
            </div>
          ) : null}
          {items.length > 0 ? <TransactionList items={items} label="Son işlemler" /> : null}
        </section>

        <aside className="space-y-4" aria-label="Hesap özeti">
          <dl className="surface-panel divide-y divide-line">
            <div className="flex items-center justify-between px-4 py-3.5">
              <dt className="text-[13px] text-ink-500">Onay bekleyen</dt>
              <dd className={pendingCount > 0 ? 'text-sm font-semibold text-warning-700' : 'text-sm font-semibold text-ink-900'}>{pendingCount}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <dt className="text-[13px] text-ink-500">İncelemede</dt>
              <dd className="text-sm font-semibold text-ink-900">{inReview}</dd>
            </div>
          </dl>
          <section className="surface-panel p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink-900">
              <ShieldCheck className="size-4 text-success-600" aria-hidden /> Nasıl korunuyorsun?
            </h2>
            <ol className="mt-3 space-y-2.5 text-[13px] text-ink-600">
              <li className="flex gap-2.5"><span className="font-mono text-ink-400">1</span>Her işlem anında risk skorlanır.</li>
              <li className="flex gap-2.5"><span className="font-mono text-ink-400">2</span>Şüpheli olan beklemeye alınır, bir analist inceler.</li>
              <li className="flex gap-2.5"><span className="font-mono text-ink-400">3</span>Gerekirse sana "Bu işlemi sen mi yaptın?" diye sorulur.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
