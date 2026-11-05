import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { listTransactions } from '@/features/transactions/api';
import { TransactionList } from '@/features/transactions/TransactionList';
import { RISK_LEVELS, type RiskLevel } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { DISPLAY_RISK_LABEL } from '@/shared/lib/risk';
import {
  Button,
  CustomerPageHeader,
  EmptyState,
  ErrorState,
  FilterChips,
  SkeletonList,
  type ChipOption,
} from '@/shared/ui';

const RISK_OPTIONS: ChipOption<RiskLevel>[] = RISK_LEVELS.map((level) => ({
  value: level,
  label: DISPLAY_RISK_LABEL[level],
}));

export function CustomerTransactionsPage({ riskLevel }: { riskLevel?: RiskLevel }) {
  const navigate = useNavigate();
  const filters = { riskLevel, limit: 50 };
  const transactions = useQuery({
    queryKey: queryKeys.transactions.list(filters),
    queryFn: () => listTransactions(filters),
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <CustomerPageHeader
        title="İşlemlerim"
        description="Her işlemin güncel durumu; açmak için üzerine dokun."
        actions={
          <Link
            to="/customer/transactions/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-control bg-tc-500 px-3.5 text-[13px] font-semibold text-night-900 transition-colors hover:bg-tc-400"
          >
            <Plus className="size-4" aria-hidden />
            Yeni işlem
          </Link>
        }
      />

      <div className="mb-4">
        <FilterChips
          allLabel="Tüm riskler"
          options={RISK_OPTIONS}
          value={riskLevel}
          onChange={(next) =>
            void navigate({
              to: '/customer/transactions',
              search: next ? { riskLevel: next } : {},
            })
          }
        />
      </div>

      {transactions.isPending ? (
        <SkeletonList rows={5} />
      ) : null}
      {transactions.isError ? (
        <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
      ) : null}
      {transactions.data?.items.length === 0 ? (
        <EmptyState
          illustration="search"
          title="İşlem bulunamadı"
          description={
            riskLevel ? 'Bu risk seviyesinde işlem yok. Filtreyi temizlemeyi dene.' : undefined
          }
          action={
            riskLevel ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void navigate({ to: '/customer/transactions', search: {} })}
              >
                Filtreyi temizle
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {transactions.data && transactions.data.items.length > 0 ? (
        <TransactionList items={transactions.data.items} label="İşlemler" />
      ) : null}
    </div>
  );
}
