/**
 * SSE event şeması.
 *
 * gelen event'ler İKİNCİ BİR GLOBAL STORE OLUŞTURMAZ. Tek işleri
 * TanStack Query cache'ini invalidate etmek (ya da hedefli `setQueryData`
 * yapmak) ve gerekirse toast göstermektir. Ekran verisi her zaman query'den
 * gelir.
 *
 * Gövde Zod ile doğrulanır: sunucudan gelen gövdeye körlemesine güvenip
 * `payload.caseId` okumak, alan adı değiştiğinde sessiz bozulma üretir.
 */

import { z } from 'zod';

/** Kanal adları backend event tiplerine karşılık gelir. */
export const REALTIME_EVENT_TYPES = [
  'case.assigned',
  'case.updated',
  'case.decided',
  'assessment.completed',
  'verification.requested',
  'verification.answered',
  'sla.breached',
  'badge.earned',
  'points.earned',
  'notification.received',
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

const caseRef = z.object({
  caseId: z.string(),
  /** Süpervizör ekranlarında satırı bulmak için. */
  transactionNo: z.string().optional(),
});

/**
 * Discriminated union: her event kendi gövdesini taşır. `type` alanı ayrım
 * anahtarıdır, böylece handler tarafında `switch` exhaustive olur.
 */
export const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('case.assigned'), data: caseRef.extend({ analystId: z.string() }) }),
  z.object({ type: z.literal('case.updated'), data: caseRef }),
  z.object({ type: z.literal('case.decided'), data: caseRef.extend({ decision: z.string() }) }),
  z.object({
    type: z.literal('assessment.completed'),
    data: z.object({ transactionId: z.string(), caseId: z.string().nullable().optional() }),
  }),
  z.object({
    type: z.literal('verification.requested'),
    data: caseRef.extend({ verificationId: z.string() }),
  }),
  z.object({
    type: z.literal('verification.answered'),
    data: caseRef.extend({ verificationId: z.string(), response: z.string() }),
  }),
  z.object({ type: z.literal('sla.breached'), data: caseRef }),
  z.object({
    type: z.literal('badge.earned'),
    data: z.object({ code: z.string(), name: z.string() }),
  }),
  z.object({
    type: z.literal('points.earned'),
    data: z.object({ points: z.number(), ruleCode: z.string(), caseId: z.string().nullable() }),
  }),
  z.object({
    id: z.string(),
    type: z.literal('notification.received'),
    data: z.object({
      notificationType: z.string(),
      title: z.string(),
      message: z.string(),
      resourceType: z.string().nullable(),
      resourceId: z.string().nullable(),
      occurredAt: z.string(),
    }),
  }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

/**
 * Ham SSE mesajını doğrular. Şemaya uymayan event sessizce yutulur ve konsola
 * yazılır — tek bozuk event yüzünden bağlantı düşmemeli.
 */
export function parseRealtimeEvent(raw: string): RealtimeEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn('[realtime] JSON olarak çözülemeyen event atlandı.');
    return null;
  }

  const result = realtimeEventSchema.safeParse(json);
  if (!result.success) {
    console.warn('[realtime] Şemaya uymayan event atlandı.', result.error.issues);
    return null;
  }
  return result.data;
}
