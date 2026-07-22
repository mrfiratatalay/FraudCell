import { SectionTitle } from '@/shared/ui';
import { BadgeGrid } from '../components/BadgeGrid';
import { CapacityMeter } from '../components/CapacityMeter';
import { PointsTimeline } from '../components/PointsTimeline';
import { useMyBadgesQuery, useMyPointsQuery, useMyScoreQuery } from '../queries';

export function AnalystPointsScreen() {
  const scoreQuery = useMyScoreQuery();
  const pointsQuery = useMyPointsQuery();
  const badgesQuery = useMyBadgesQuery();

  return (
    <div className="space-y-6">
      <SectionTitle>Puanlarım ve rozetler</SectionTitle>

      {scoreQuery.data && <CapacityMeter score={scoreQuery.data} />}
      {badgesQuery.data && <BadgeGrid badges={badgesQuery.data} />}

      <PointsTimeline
        entries={pointsQuery.data}
        isLoading={pointsQuery.isLoading}
        isError={pointsQuery.isError}
        error={pointsQuery.error}
        onRetry={() => void pointsQuery.refetch()}
      />
    </div>
  );
}
