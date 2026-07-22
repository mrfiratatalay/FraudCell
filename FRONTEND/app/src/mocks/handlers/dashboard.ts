import { http } from 'msw';
import { API_PREFIX } from '@/shared/config/env';
import { pendingEndpoints } from '@/shared/api/endpoints';
import { dashboardSnapshot } from '../seed/dashboard-seed';
import { ok } from '../envelope';

/**
 * Dashboard aggregate uçlarının mock'u.
 *
 * ⚠️ Backend'i HENÜZ YAZILMAMIŞ (contract-pending.ts). Sahibi: B tarafı.
 */

const path = (suffix: string) => `${API_PREFIX}${suffix}`;

export const dashboardHandlers = [
  http.get(path(pendingEndpoints.dashboard.root), () => {
    const snapshot = dashboardSnapshot();
    return ok(snapshot, { generatedAt: snapshot.generatedAt });
  }),
];
