import type { RequestHandler } from 'msw';
import { identityHandlers } from './identity';
import { caseHandlers } from './cases';
import { gamificationHandlers } from './gamification';
import { dashboardHandlers } from './dashboard';
import { aiHandlers } from './ai';

/**
 * MSW handler kaydı.
 *
 * ── Çakışma kuralı ────────────────────────────────────────────────────────
 * Handler'lar SERVİS BAZINDA AYRI DOSYALARDA tutulur ve buraya import edilir.
 * Tek bir `handlers.ts` dosyası olsaydı iki kişi her ekranda aynı dosyayı
 * düzenler ve sürekli merge çakışması yaşardı.
 *
 *   A tarafı  →  identity.ts, transactions.ts, staff.ts, audit.ts
 *   B tarafı  →  cases.ts, gamification.ts, dashboard.ts, ai.ts
 *
 * Yeni dosya eklerken yalnızca aşağıdaki diziye bir satır eklenir.
 *
 * ── Sıralama ──────────────────────────────────────────────────────────────
 * MSW ilk eşleşen handler'ı kullanır. Sabit yollar parametreli yollardan ÖNCE
 * gelmeli (`/cases/assigned`, `/cases/{caseId}`ten önce) — aksi hâlde
 * "assigned" bir caseId olarak yakalanır.
 */
export const handlers: RequestHandler[] = [
  ...identityHandlers,

  // A tarafı ekleyecek:
  // ...transactionHandlers,
  // ...staffHandlers,
  // ...auditHandlers,

  ...caseHandlers,
  ...gamificationHandlers,
  ...dashboardHandlers,
  ...aiHandlers,
];
