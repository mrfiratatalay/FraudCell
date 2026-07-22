import { useNavigate } from '@tanstack/react-router';
import { supervisorCasesRoute } from '@/app/router/routes';
import { SectionTitle } from '@/shared/ui';
import { allCasesColumns } from '../columns/all-cases-columns';
import { CaseFilterBar } from '../components/CaseFilterBar';
import { CaseTable } from '../components/CaseTable';
import { LoadMoreButton } from '../components/LoadMoreButton';
import { useAllCasesInfiniteQuery } from '../queries';

/**
 * Tek gerçek infinite-scroll ekranı — `GET /cases` cursor pagination'a sahip
 * (bkz. `06-DATA-ARCHITECTURE`/backend `ListCasesEndpoints.cs`). URL'deki
 * `cursor` search param'ı sorguyu YÖNETMEZ (paylaşılabilirlik için "son
 * istenen cursor" bilgisidir); asıl sayfalama `useInfiniteQuery`'nin kendi
 * `pageParam` state'i üzerinden yürür.
 */
export function SupervisorCasesScreen() {
  const search = supervisorCasesRoute.useSearch();
  const navigate = useNavigate();
  const query = useAllCasesInfiniteQuery({ status: search.status, riskLevel: search.riskLevel });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <SectionTitle>Tüm vakalar</SectionTitle>

      <CaseFilterBar
        status={search.status}
        onStatusChange={(status) =>
          void navigate({ to: supervisorCasesRoute.to, search: { ...search, status } })
        }
        riskLevel={search.riskLevel}
        onRiskLevelChange={(riskLevel) =>
          void navigate({ to: supervisorCasesRoute.to, search: { ...search, riskLevel } })
        }
      />

      <CaseTable
        columns={allCasesColumns}
        data={items}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Filtreye uyan vaka yok"
        getRowId={(row) => row.caseId}
        onRowClick={(row) =>
          void navigate({ to: '/supervisor/cases/$caseId', params: { caseId: row.caseId } })
        }
      />

      <LoadMoreButton
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        onClick={() => {
          void query.fetchNextPage().then((result) => {
            const lastCursor = result.data?.pages.at(-1)?.page.nextCursor;
            if (lastCursor) {
              void navigate({
                to: supervisorCasesRoute.to,
                search: { ...search, cursor: lastCursor },
                replace: true,
              });
            }
          });
        }}
      />
    </div>
  );
}
