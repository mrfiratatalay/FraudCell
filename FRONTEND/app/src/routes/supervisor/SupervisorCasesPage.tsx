import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { listCases } from '@/features/cases/api';
import { CaseTable } from '@/features/cases/CaseTable';
import {
  CASE_STATUSES,
  CASE_STATUS_LABEL,
  RISK_LEVELS,
  RISK_LEVEL_LABEL,
  type CaseStatus,
  type RiskLevel,
} from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { Button, EmptyState, ErrorState, FilterChips, PageHeader, SkeletonList, type ChipOption } from '@/shared/ui';

const STATUS_OPTIONS: ChipOption<CaseStatus>[] = CASE_STATUSES.map((status) => ({
  value: status,
  label: CASE_STATUS_LABEL[status],
}));

const RISK_OPTIONS: ChipOption<RiskLevel>[] = RISK_LEVELS.map((level) => ({
  value: level,
  label: RISK_LEVEL_LABEL[level],
}));

export function SupervisorCasesPage({
  status,
  riskLevel,
  cursor,
}: {
  status?: CaseStatus;
  riskLevel?: RiskLevel;
  cursor?: string;
}) {
  const navigate = useNavigate();
  const filters = { status, riskLevel, cursor };
  const cases = useQuery({
    queryKey: queryKeys.cases.list(filters),
    queryFn: () => listCases({ ...filters, limit: 30 }),
  });

  const setSearch = (next: Record<string, string | undefined>) => {
    void navigate({ to: '/supervisor/cases', search: { status, riskLevel, ...next } });
  };

  const items = cases.data?.items ?? [];

  return (
    <div>
      <PageHeader title="Tüm vakalar" description="Bütün vakalar; risk ve duruma göre süz." />

      <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <FilterChips
          options={STATUS_OPTIONS}
          value={status}
          onChange={(next) => setSearch({ status: next, cursor: undefined })}
        />
        <FilterChips
          options={RISK_OPTIONS}
          value={riskLevel}
          allLabel="Tüm riskler"
          onChange={(next) => setSearch({ riskLevel: next, cursor: undefined })}
        />
      </div>

      {cases.isError ? (
        <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
      ) : cases.isPending ? (
        <SkeletonList rows={6} />
      ) : items.length === 0 ? (
        <div className="surface-panel">
          <EmptyState illustration="search" title="Bu filtrede vaka yok" description="Filtrelerden birini kaldırmayı dene." />
        </div>
      ) : (
        <CaseTable items={items} to="/supervisor/cases/$caseId" label="Vakalar" />
      )}

      {cases.data?.page.hasMore && cases.data.page.nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => setSearch({ cursor: cases.data?.page.nextCursor ?? undefined })}
          >
            Sonraki sayfa
          </Button>
        </div>
      ) : null}
    </div>
  );
}
