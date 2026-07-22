import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Plus, Receipt } from 'lucide-react';
import { Button, EmptyState, ErrorState, SkeletonList } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { RISK_LEVELS, RISK_LEVEL_LABEL, type RiskLevel } from '@/shared/api/enums';
import { useTransactions } from '@/features/transactions/hooks';
import { TransactionRow } from '@/features/transactions/components/TransactionRow';

/**
 * İşlem listesi.
 *
 * Filtre URL'de (`?riskLevel=KRITIK`): sayfa yenilenince kaybolmaz, link
 * paylaşılabilir, geri/ileri tuşları doğru çalışır (DESIGN.MD).
 *
 * Sayfalama cursor tabanlı olduğu için "1 2 3 ... 12" gösterilemez; backend
 * toplam kayıt sayısı döndürmüyor. Bunun yerine "Daha fazla yükle".
 */
export function CustomerTransactions() {
  const navigate = useNavigate();
  const { riskLevel } = useSearch({ from: '/customer/transactions' });

  const query = useTransactions(riskLevel ? { riskLevel } : {});
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const setFilter = (next: RiskLevel | undefined) => {
    void navigate({
      to: '/customer/transactions',
      search: next ? { riskLevel: next } : {},
    });
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">İşlemlerim</h1>
        <Link to="/customer/transactions/new">
          <Button size="sm" leadingIcon={<Plus className="size-4" />}>
            Yeni
          </Button>
        </Link>
      </div>

      {/* ------------------------------------------------------- filtre -- */}
      <div
        role="group"
        aria-label="Risk seviyesi filtresi"
        className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <FilterChip active={!riskLevel} onClick={() => setFilter(undefined)}>
          Tümü
        </FilterChip>
        {RISK_LEVELS.map((level) => (
          <FilterChip
            key={level}
            active={riskLevel === level}
            onClick={() => setFilter(level)}
          >
            {RISK_LEVEL_LABEL[level]}
          </FilterChip>
        ))}
      </div>

      {/* -------------------------------------------------------- liste -- */}
      {query.isPending ? (
        <SkeletonList rows={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={riskLevel ? 'Bu filtrede işlem yok' : 'Henüz işlemin yok'}
          description={
            riskLevel
              ? 'Farklı bir risk seviyesi seçmeyi dene.'
              : 'İlk işlemini oluşturduğunda burada görünecek.'
          }
          action={
            riskLevel ? (
              <Button variant="secondary" onClick={() => setFilter(undefined)}>
                Filtreyi temizle
              </Button>
            ) : (
              <Link to="/customer/transactions/new">
                <Button leadingIcon={<Plus className="size-4" />}>İşlem Oluştur</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((tx) => (
              <li key={tx.transactionId}>
                <TransactionRow tx={tx} />
              </li>
            ))}
          </ul>

          {query.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Daha fazla yükle
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'bg-brand-700 text-white'
          : 'bg-white text-ink-500 ring-1 ring-ink-200 hover:bg-ink-100',
      )}
    >
      {children}
    </button>
  );
}
