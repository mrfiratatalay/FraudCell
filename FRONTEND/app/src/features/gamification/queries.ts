import { useQuery } from '@tanstack/react-query';
import { pendingEndpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import { fetchData } from '@/shared/api/client';
import type {
  AnalystScoreResponse,
  BadgeResponse,
  LeaderboardEntry,
  LeaderboardPeriod,
  PointEntry,
} from '@/shared/api/contract-pending';

/**
 * ⚠️ Backend'i HENÜZ YAZILMAMIŞ (contract-pending.ts). Gerçek servis
 * yazıldığında bu hook'lar `contract.ts`'e taşınan tiplerle güncellenir.
 */

export function useMyScoreQuery() {
  return useQuery({
    queryKey: queryKeys.gamification.me,
    queryFn: () => fetchData<AnalystScoreResponse>(pendingEndpoints.gamification.me),
  });
}

export function useMyPointsQuery() {
  return useQuery({
    queryKey: queryKeys.gamification.points,
    queryFn: () => fetchData<PointEntry[]>(pendingEndpoints.gamification.points),
  });
}

export function useMyBadgesQuery() {
  return useQuery({
    queryKey: queryKeys.gamification.badges,
    queryFn: () => fetchData<BadgeResponse[]>(pendingEndpoints.gamification.badges),
  });
}

export function useLeaderboardQuery(period: LeaderboardPeriod) {
  return useQuery({
    queryKey: queryKeys.gamification.leaderboard(period),
    queryFn: () =>
      fetchData<LeaderboardEntry[]>(pendingEndpoints.gamification.leaderboard, { query: { period } }),
  });
}
