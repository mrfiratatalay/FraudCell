import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { pendingEndpoints } from '@/shared/api/endpoints';
import { queryKeys } from '@/shared/api/query-keys';
import type { AppNotification } from '@/shared/api/contract-pending';

/**
 * ⚠️ Bildirim servisinin BACKEND'İ HENÜZ YAZILMADI.
 *
 * Bu hook'lar `pendingEndpoints` kullanıyor ve yalnızca MSW mock'u tarafından
 * karşılanıyor. Servis yazıldığında yapılacaklar:
 *   1. `pendingEndpoints.notifications` → `endpoints.notifications`
 *   2. Tipi `contract-pending.ts`ten `contract.ts`e taşı
 *   3. `mocks/handlers/notifications.ts` dosyasını sil
 */

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () =>
      api.get<AppNotification[]>(pendingEndpoints.notifications.root).then((r) => r.data),
  });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read).length ?? 0;
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) =>
      api.post<void>(pendingEndpoints.notifications.read(notificationId)).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<void>(pendingEndpoints.notifications.readAll).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
