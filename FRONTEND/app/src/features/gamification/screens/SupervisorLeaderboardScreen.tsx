import { useNavigate } from '@tanstack/react-router';
import { supervisorLeaderboardRoute } from '@/app/router/routes';
import { SectionTitle, Tabs } from '@/shared/ui';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { useLeaderboardQuery } from '../queries';

export function SupervisorLeaderboardScreen() {
  const search = supervisorLeaderboardRoute.useSearch();
  const navigate = useNavigate();
  const query = useLeaderboardQuery(search.period);

  return (
    <div className="space-y-4">
      <SectionTitle>Liderlik tablosu</SectionTitle>

      <Tabs
        items={[
          { value: 'daily', label: 'Günlük' },
          { value: 'weekly', label: 'Haftalık' },
        ]}
        value={search.period}
        onValueChange={(period) =>
          void navigate({ to: supervisorLeaderboardRoute.to, search: { period } })
        }
      />

      <LeaderboardTable
        entries={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    </div>
  );
}
