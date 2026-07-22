import { useQuery } from '@tanstack/react-query';
import { pendingEndpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import { fetchData } from '@/shared/api/client';
import type { AiMetricsResponse, DashboardResponse } from '@/shared/api/contract-pending';

/**
 * ⚠️ Backend'i HENÜZ YAZILMAMIŞ (contract-pending.ts). DESIGN.MD kural 2:
 * metrikler burada HESAPLANMAZ, yalnızca servisin döndürdüğü aggregate
 * görselleştirilir.
 */

export function useDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => fetchData<DashboardResponse>(pendingEndpoints.dashboard.root),
  });
}

export function useAiMetricsQuery() {
  return useQuery({
    queryKey: queryKeys.aiMetrics,
    queryFn: () => fetchData<AiMetricsResponse>(pendingEndpoints.ai.metrics),
  });
}
