import { useState } from 'react';
import { supervisorCaseDetailRoute } from '@/app/router/routes';
import { Button, Card, ErrorState, SkeletonList, TabPanel, Tabs } from '@/shared/ui';
import { CaseDetailHeader } from '../components/CaseDetailHeader';
import { CaseHistoryTimeline } from '../components/CaseHistoryTimeline';
import { CaseNotesPanel } from '../components/CaseNotesPanel';
import { ConflictBanner } from '../components/ConflictBanner';
import { FraudTypeOverrideDialog } from '../components/FraudTypeOverrideDialog';
import { ManualAssignmentDialog } from '../components/ManualAssignmentDialog';
import { ReassignmentDialog } from '../components/ReassignmentDialog';
import { RiskLevelOverrideDialog } from '../components/RiskLevelOverrideDialog';
import { useCaseDetailQuery, useCaseHistoryQuery } from '../queries';

const CLOSED_STATUSES = new Set(['ONAYLANDI', 'BLOKLANDI', 'KAPANDI']);

export function SupervisorCaseDetailScreen() {
  const { caseId } = supervisorCaseDetailRoute.useParams();
  const [tab, setTab] = useState<'history' | 'notes'>('history');
  const [conflict, setConflict] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const caseQuery = useCaseDetailQuery(caseId);
  const historyQuery = useCaseHistoryQuery(caseId);

  if (caseQuery.isLoading) return <SkeletonList rows={4} />;
  if (caseQuery.isError) {
    return <ErrorState error={caseQuery.error} onRetry={() => void caseQuery.refetch()} />;
  }
  if (!caseQuery.data) return null;

  const c = caseQuery.data;
  const closed = CLOSED_STATUSES.has(c.status);

  const handleConflict = () => setConflict(true);
  const handleRefresh = () => {
    setConflict(false);
    void caseQuery.refetch();
  };

  return (
    <div className="space-y-4">
      {conflict && <ConflictBanner onRefresh={handleRefresh} />}

      <CaseDetailHeader c={c} />

      <div className="flex flex-wrap gap-2">
        {c.assignedAnalystId ? (
          <ReassignmentDialog
            caseId={caseId}
            version={c.version}
            currentAnalystId={c.assignedAnalystId}
            onConflict={handleConflict}
          />
        ) : (
          <>
            <Button onClick={() => setAssignOpen(true)}>Analiste ata</Button>
            <ManualAssignmentDialog
              open={assignOpen}
              onOpenChange={setAssignOpen}
              caseId={caseId}
              version={c.version}
              onConflict={handleConflict}
            />
          </>
        )}

        {!closed && (
          <>
            <FraudTypeOverrideDialog
              caseId={caseId}
              version={c.version}
              currentFraudType={c.effectiveRisk.fraudType}
              onConflict={handleConflict}
            />
            <RiskLevelOverrideDialog
              caseId={caseId}
              version={c.version}
              currentRiskLevel={c.effectiveRisk.riskLevel}
              onConflict={handleConflict}
            />
          </>
        )}
      </div>

      <Card flush>
        <Tabs
          items={[
            { value: 'history', label: 'Geçmiş' },
            { value: 'notes', label: 'Notlar' },
          ]}
          value={tab}
          onValueChange={setTab}
        >
          <TabPanel value="history" className="p-4">
            <CaseHistoryTimeline
              history={historyQuery.data}
              isLoading={historyQuery.isLoading}
              isError={historyQuery.isError}
              error={historyQuery.error}
              onRetry={() => void historyQuery.refetch()}
            />
          </TabPanel>
          <TabPanel value="notes" className="p-4">
            <CaseNotesPanel caseId={caseId} />
          </TabPanel>
        </Tabs>
      </Card>
    </div>
  );
}
