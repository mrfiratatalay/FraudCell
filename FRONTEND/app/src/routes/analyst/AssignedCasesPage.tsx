import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { listAssignedCases } from '@/features/cases/api';
import { CaseTable } from '@/features/cases/CaseTable';
import { CASE_STATUSES, CASE_STATUS_LABEL, type CaseStatus } from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { cn } from '@/shared/lib/cn';
import { EmptyState, ErrorState, FilterChips, PageHeader, SkeletonList, type ChipOption } from '@/shared/ui';

const STATUS_OPTIONS: ChipOption<CaseStatus>[] = CASE_STATUSES.map((status) => ({
  value: status,
  label: CASE_STATUS_LABEL[status],
}));

/** The analyst's inbox: their cases, riskiest and most urgent first. */
export function AssignedCasesPage({ status }: { status?: CaseStatus }) {
  const navigate = useNavigate();
  const cases = useQuery({
    queryKey: queryKeys.cases.assigned({ status }),
    queryFn: () => listAssignedCases({ status, limit: 50 }),
  });

  const items = cases.data?.items ?? [];
  const open = items.filter((item) => item.sla.stoppedAt === null);
  const urgent = open.filter((item) => item.sla.status === 'URGENT' || item.sla.breachedAt !== null).length;
  const critical = open.filter((item) => item.effectiveRisk.riskLevel === 'KRITIK').length;

  return (
    <div>
      <PageHeader
        title="Vakalarım"
        description={
          cases.isSuccess ? (
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <Count value={open.length} label="açık" />
              <Count value={urgent} label="SLA acil" tone={urgent > 0 ? 'text-critical-600' : undefined} />
              <Count value={critical} label="kritik risk" tone={critical > 0 ? 'text-critical-600' : undefined} />
            </span>
          ) : (
            'Sana atanan vakalar, en riskli ve en acil olan üstte.'
          )
        }
      />

      <FilterChips
        className="mb-4"
        options={STATUS_OPTIONS}
        value={status}
        onChange={(next) => void navigate({ to: '/analyst', search: next ? { status: next } : {} })}
      />

      {cases.isPending ? <SkeletonList rows={5} /> : null}
      {cases.isError ? <ErrorState error={cases.error} onRetry={() => void cases.refetch()} /> : null}
      {cases.isSuccess && items.length === 0 ? (
        <div className="surface-panel">
          <EmptyState
            illustration="secure"
            title={status ? `${CASE_STATUS_LABEL[status]} durumunda vaka yok` : 'Sana atanmış vaka yok'}
            description="Yeni atamalar bu listeye kendiliğinden düşer."
          />
        </div>
      ) : null}
      {items.length > 0 ? <CaseTable items={items} to="/analyst/cases/$caseId" label="Atanmış vakalar" /> : null}
    </div>
  );
}

function Count({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <span>
      <span className={cn('font-semibold text-ink-900 tabular', tone)}>{value}</span> {label}
    </span>
  );
}
