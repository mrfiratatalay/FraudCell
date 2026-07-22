import { useState } from 'react';
import { analystCaseDetailRoute } from '@/app/router/routes';
import { Card, ErrorState, SkeletonList, TabPanel, Tabs } from '@/shared/ui';
import { CaseDetailHeader } from '../components/CaseDetailHeader';
import { CaseHistoryTimeline } from '../components/CaseHistoryTimeline';
import { CaseNotesPanel } from '../components/CaseNotesPanel';
import { ConflictBanner } from '../components/ConflictBanner';
import { DecisionDialog } from '../components/DecisionDialog';
import { RequestVerificationDialog } from '../components/RequestVerificationDialog';
import { StartReviewButton } from '../components/StartReviewButton';
import { useCaseDetailQuery, useCaseHistoryQuery } from '../queries';

export function AnalystCaseDetailScreen() {
  const { caseId } = analystCaseDetailRoute.useParams();
  const [tab, setTab] = useState<'history' | 'notes'>('history');
  const [conflict, setConflict] = useState(false);

  const caseQuery = useCaseDetailQuery(caseId);
  const historyQuery = useCaseHistoryQuery(caseId);

  if (caseQuery.isLoading) return <SkeletonList rows={4} />;
  if (caseQuery.isError) {
    return <ErrorState error={caseQuery.error} onRetry={() => void caseQuery.refetch()} />;
  }
  if (!caseQuery.data) return null;

  const c = caseQuery.data;

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
        {c.status === 'ATANDI' && (
          <StartReviewButton caseId={caseId} version={c.version} onConflict={handleConflict} />
        )}
        {c.status === 'INCELENIYOR' && (
          <>
            <RequestVerificationDialog caseId={caseId} version={c.version} onConflict={handleConflict} />
            <DecisionDialog caseId={caseId} version={c.version} onConflict={handleConflict} />
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
