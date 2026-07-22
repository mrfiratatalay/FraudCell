import { http } from 'msw';
import { API_PREFIX } from '@/shared/config/env';
import { pendingEndpoints } from '@/shared/api/endpoints';
import { aiMetricsSnapshot } from '../seed/dashboard-seed';
import { ok } from '../envelope';

/**
 * AI doğruluk metriği ucunun mock'u.
 *
 * ⚠️ Backend'i HENÜZ YAZILMAMIŞ (contract-pending.ts). Sahibi: B tarafı.
 */

const path = (suffix: string) => `${API_PREFIX}${suffix}`;

export const aiHandlers = [
  http.get(path(pendingEndpoints.ai.metrics), () => ok(aiMetricsSnapshot())),
];
