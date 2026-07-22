import { useNavigate } from '@tanstack/react-router';
import { analystCasesRoute } from '@/app/router/routes';
import { SectionTitle } from '@/shared/ui';
import { assignedColumns } from '../columns/assigned-columns';
import { CaseFilterBar } from '../components/CaseFilterBar';
import { CaseTable } from '../components/CaseTable';
import { useAssignedCasesQuery } from '../queries';

export function AnalystCasesScreen() {
  const search = analystCasesRoute.useSearch();
  const navigate = useNavigate();
  const query = useAssignedCasesQuery({ status: search.status });

  return (
    <div className="space-y-4">
      <SectionTitle>Vakalarım</SectionTitle>

      <CaseFilterBar
        status={search.status}
        onStatusChange={(status) =>
          void navigate({ to: analystCasesRoute.to, search: { status } })
        }
      />

      <CaseTable
        columns={assignedColumns}
        data={query.data?.items ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Sana atanmış açık vaka yok"
        emptyDescription="Yeni bir vaka atandığında burada görünecek."
        getRowId={(row) => row.caseId}
        onRowClick={(row) =>
          void navigate({ to: '/analyst/cases/$caseId', params: { caseId: row.caseId } })
        }
      />
    </div>
  );
}
