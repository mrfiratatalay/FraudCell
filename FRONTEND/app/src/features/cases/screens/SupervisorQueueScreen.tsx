import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { supervisorQueueRoute } from '@/app/router/routes';
import { SectionTitle, Tabs } from '@/shared/ui';
import type { AssignmentQueueItemResponse } from '@/shared/api/contract';
import { buildQueueColumns } from '../columns/queue-columns';
import { CaseTable } from '../components/CaseTable';
import { ConflictBanner } from '../components/ConflictBanner';
import { ManualAssignmentDialog } from '../components/ManualAssignmentDialog';
import { useAssignmentQueueQuery } from '../queries';

export function SupervisorQueueScreen() {
  const search = supervisorQueueRoute.useSearch();
  const navigate = useNavigate();
  const query = useAssignmentQueueQuery(search.queueType);

  const [selected, setSelected] = useState<AssignmentQueueItemResponse | null>(null);
  const [conflict, setConflict] = useState(false);

  const columns = buildQueueColumns((item) => setSelected(item));

  return (
    <div className="space-y-4">
      <SectionTitle>Atama kuyruğu</SectionTitle>

      {conflict && (
        <ConflictBanner
          onRefresh={() => {
            setConflict(false);
            void query.refetch();
          }}
        />
      )}

      <Tabs
        items={[
          { value: 'QUEUED', label: 'Kapasite bekleyen' },
          { value: 'MANUAL_QUEUE', label: 'Manuel inceleme' },
        ]}
        value={search.queueType}
        onValueChange={(queueType) => void navigate({ to: supervisorQueueRoute.to, search: { queueType } })}
      />

      <CaseTable
        columns={columns}
        data={query.data?.items ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Kuyrukta bekleyen vaka yok"
        getRowId={(row) => row.caseId}
      />

      {selected && (
        <ManualAssignmentDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          caseId={selected.caseId}
          version={selected.version}
          onConflict={() => {
            setSelected(null);
            setConflict(true);
          }}
        />
      )}
    </div>
  );
}
