import { http } from 'msw';
import { API_PREFIX } from '@/shared/config/env';
import { pendingEndpoints } from '@/shared/api/endpoints';
import { ERROR_CODES } from '@/shared/api/errors';
import type { LeaderboardPeriod } from '@/shared/api/contract-pending';
import { userFromRequest } from '../db';
import { badgesFor, ledgerFor, leaderboard, scoreFor } from '../seed/gamification-seed';
import { fail, ok } from '../envelope';

/**
 * Gamification uçlarının mock'u.
 *
 * ⚠️ Backend'i HENÜZ YAZILMAMIŞ (contract-pending.ts). Gerçek servis
 * yazıldığında şekiller `contract.ts`'e taşınır ve bu dosya silinir.
 *
 * Sahibi: B tarafı.
 */

const path = (suffix: string) => `${API_PREFIX}${suffix}`;

export const gamificationHandlers = [
  http.get(path(pendingEndpoints.gamification.me), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Giriş yapmalısın.');
    return ok(scoreFor(user.id));
  }),

  http.get(path(pendingEndpoints.gamification.points), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Giriş yapmalısın.');
    return ok(ledgerFor(user.id));
  }),

  http.get(path(pendingEndpoints.gamification.badges), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Giriş yapmalısın.');
    return ok(badgesFor(user.id));
  }),

  http.get(path(pendingEndpoints.gamification.leaderboard), ({ request }) => {
    const user = userFromRequest(request);
    if (!user) return fail(401, ERROR_CODES.AUTHENTICATION_REQUIRED, 'Giriş yapmalısın.');

    const url = new URL(request.url);
    const period = (url.searchParams.get('period') as LeaderboardPeriod | null) ?? 'daily';
    return ok(leaderboard(period, user.id));
  }),
];
