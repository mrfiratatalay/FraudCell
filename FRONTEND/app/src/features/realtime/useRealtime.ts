import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { env } from '@/shared/config/env';
import { api } from '@/shared/api/client';
import type { StreamTicketResponse } from '@/shared/api/contract';
import { endpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import { useToast } from '@/shared/ui';
import { useSession } from '@/features/authentication/useSession';
import { recordLiveNotification } from '@/features/notifications/model';
import { parseRealtimeEvent, type RealtimeEvent } from './events';

/**
 * Tek kullanıcı = tek SSE bağlantısı.
 *
 * Bu hook uygulama kökünde BİR KEZ çağrılır. Ekranlar kendi bağlantısını
 * açmaz; hepsi query cache üzerinden güncellenir.
 *
 * ── Token sorunu ──────────────────────────────────────────────────────────
 * Native `EventSource` arbitrary `Authorization` header gönderemez. Uzun ömürlü
 * JWT'yi query string'e koymak yanlış olur: URL log'lara, Referer'a ve tarayıcı
 * geçmişine sızar. Çözüm kısa ömürlü, tek kullanımlık bir
 * "stream ticket" üretmektir.
 *
 * Gateway'den JWT ile kısa ömürlü, tek kullanımlık ticket alınır. Native
 * `EventSource` yalnızca bu ticket'i query string'de taşır; erişim ve refresh
 * token'ları URL'ye hiçbir zaman yazılmaz.
 */

interface RealtimeContext {
  queryClient: QueryClient;
  toast: ReturnType<typeof useToast>;
}

/** Birleşimden tek bir event varyantını çeker. */
type EventOf<T extends RealtimeEvent['type']> = Extract<RealtimeEvent, { type: T }>;

/**
 * Her handler YALNIZCA kendi event varyantını alır.
 *
 * Düz `Record<type, (e: RealtimeEvent) => void>` yazılsaydı her handler
 * birleşimin tamamını görür ve `event.data.caseId` okumak için tek tek
 * daraltma yapmak gerekirdi.
 */
type HandlerMap = {
  [K in RealtimeEvent['type']]: (event: EventOf<K>, ctx: RealtimeContext) => void;
};

/**
 * Event → invalidation eşlemesi.
 *
 * Her iki taraf (müşteri ekranları / operasyon konsolu) kendi ekranını buraya
 * eklemek yerine, ilgili query anahtarını invalidate eder. Ekran açıksa
 * yenilenir, kapalıysa hiçbir maliyeti olmaz.
 */
const HANDLERS: HandlerMap = {
  'case.assigned': (event, { queryClient, toast }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
    toast.info('Yeni vaka atandı', `Vaka ${event.data.transactionNo ?? event.data.caseId}`);
  },

  'case.updated': (event, { queryClient }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(event.data.caseId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
  },

  'case.decided': (event, { queryClient }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(event.data.caseId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  },

  'assessment.completed': (event, { queryClient }) => {
    // Müşteri "değerlendiriliyor" gören işlemi bu event'le gerçek skora döner.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.transactions.detail(event.data.transactionId),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  },

  'verification.requested': (event, { queryClient, toast }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.pendingVerifications });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(event.data.caseId) });
    toast.warning('Doğrulama bekleniyor', 'Bir işlemin için onayın isteniyor.');
  },

  'verification.answered': (event, { queryClient }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(event.data.caseId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.pendingVerifications });
  },

  'sla.breached': (event, { queryClient, toast }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    toast.error('SLA aşıldı', `Vaka ${event.data.transactionNo ?? event.data.caseId}`);
  },

  'badge.earned': (event, { queryClient, toast }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });
    toast.success('Yeni rozet kazandın', event.data.name);
  },

  'points.earned': (_event, { queryClient }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });
  },

  'notification.received': (event, { queryClient, toast }) => {
    const { notificationType, resourceId, title, message } = event.data;

    recordLiveNotification(queryClient, { id: event.id, ...event.data });

    if (notificationType.startsWith('AI_ASSESSMENT') || notificationType === 'SUSPICIOUS_TRANSACTION_DETECTED') {
      if (resourceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.detail(resourceId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    }

    if (notificationType === 'CASE_ASSIGNED' || notificationType === 'CASE_DECISION_MADE' || notificationType === 'SLA_BREACHED') {
      if (resourceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(resourceId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.cases.all });
    }

    if (notificationType === 'CUSTOMER_VERIFICATION_REQUESTED') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pendingVerifications });
    }

    if (notificationType === 'POINTS_AWARDED' || notificationType === 'BADGE_EARNED') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });
    }

    if (notificationType === 'BADGE_EARNED' || notificationType === 'CASE_DECISION_MADE') {
      toast.success(title, message);
    } else if (notificationType === 'SLA_BREACHED' || notificationType === 'SUSPICIOUS_TRANSACTION_DETECTED') {
      toast.warning(title, message);
    } else {
      toast.info(title, message);
    }
  },
};

/**
 * Event'i kendi handler'ına yollar.
 *
 * TypeScript `HANDLERS[event.type]` ile `event` arasındaki bağı kuramıyor
 * (ikisi bağımsız daraltılıyor), bu yüzden çağrı noktasında tek bir kontrollü
 * cast var. `HANDLERS` tarafındaki tip güvenliği korunuyor: eksik ya da yanlış
 * imzalı bir handler hâlâ derleme hatası verir.
 */
function dispatch(event: RealtimeEvent, ctx: RealtimeContext): void {
  const handler = HANDLERS[event.type] as (e: RealtimeEvent, c: RealtimeContext) => void;
  handler(event, ctx);
}

/** Bağlantı koptuğunda üstel geri çekilme — sunucuyu yeniden bağlanmayla boğmayalım. */
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export function useRealtime(): void {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { status, user } = useSession();

  // Handler'lar her render'da değişmesin diye ref'te tutuluyor; aksi hâlde
  // effect her render'da bağlantıyı kapatıp yeniden açardı.
  const ctxRef = useRef<RealtimeContext>({ queryClient, toast });
  ctxRef.current = { queryClient, toast };

  useEffect(() => {
    // Oturum yokken bağlanma; mock modda SSE ucu da yok.
    if (status !== 'authenticated' || env.isMock || !env.realtimeEnabled) return;

    let source: EventSource | null = null;
    let retry = 0;
    let reconnectTimer: number | undefined;
    let closed = false;

    const scheduleReconnect = () => {
      if (closed) return;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** retry, RECONNECT_MAX_MS);
      retry += 1;
      reconnectTimer = window.setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      if (closed) return;

      let ticket: StreamTicketResponse;
      try {
        ticket = (await api.post<StreamTicketResponse>(endpoints.realtime.tickets)).data;
      } catch {
        scheduleReconnect();
        return;
      }

      if (closed) return;
      source = new EventSource(`${env.eventsPath}?ticket=${encodeURIComponent(ticket.ticket)}`);

      source.onopen = () => {
        retry = 0;
      };

      source.onmessage = (message) => {
        const event = parseRealtimeEvent(message.data as string);
        if (!event) return;
        dispatch(event, ctxRef.current);
      };

      source.onerror = () => {
        source?.close();
        scheduleReconnect();
      };
    };

    void connect();

    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [status, user?.id]);
}
