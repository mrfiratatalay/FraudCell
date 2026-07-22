import { Link } from '@tanstack/react-router';
import {
  Award,
  Bell,
  BellOff,
  CheckCheck,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { Button, EmptyState, ErrorState, SkeletonList } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { formatRelative } from '@/shared/lib/format';
import type { AppNotification, NotificationKind } from '@/shared/api/contract-pending';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from '@/features/notifications/hooks';

/**
 * Bildirim merkezi (UX-CUS-004).
 *
 * ⚠️ Notification Service'in backend'i henüz yazılmadı; veri MSW mock'undan
 * geliyor. Gerçek sistemde bu liste SSE ile canlı tazelenecek — `useRealtime`
 * zaten `queryKeys.notifications`ı invalidate ediyor.
 */

const ICONS: Record<NotificationKind, { icon: typeof Bell; tone: string }> = {
  AI_ASSESSMENT_COMPLETED: { icon: Cpu, tone: 'bg-brand-100 text-brand-700' },
  CASE_ASSIGNED: { icon: ShieldCheck, tone: 'bg-brand-100 text-brand-700' },
  VERIFICATION_REQUESTED: { icon: ShieldAlert, tone: 'bg-warning-100 text-warning-700' },
  POINTS_EARNED: { icon: Award, tone: 'bg-aqua-50 text-aqua-700' },
  BADGE_EARNED: { icon: Award, tone: 'bg-aqua-50 text-aqua-700' },
  SLA_CRITICAL: { icon: TriangleAlert, tone: 'bg-critical-100 text-critical-700' },
  CASE_CLOSED: { icon: ShieldCheck, tone: 'bg-success-100 text-success-700' },
};

export function CustomerNotifications() {
  const query = useNotifications();
  const markAll = useMarkAllRead();

  const items = query.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Bildirimler</h1>
          {unread > 0 && (
            <p className="mt-0.5 text-sm text-ink-500">{unread} okunmamış bildirim</p>
          )}
        </div>

        {unread > 0 && (
          <Button
            size="sm"
            variant="ghost"
            loading={markAll.isPending}
            leadingIcon={<CheckCheck className="size-4" />}
            onClick={() => markAll.mutate()}
          >
            Tümünü okundu işaretle
          </Button>
        )}
      </div>

      {query.isPending ? (
        <SkeletonList rows={4} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff />}
          title="Bildirimin yok"
          description="İşlemlerinle ilgili gelişmeler burada görünecek."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <NotificationRow notification={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const markRead = useMarkRead();
  const spec = ICONS[notification.kind] ?? {
    icon: Bell,
    tone: 'bg-ink-100 text-ink-500',
  };
  const Icon = spec.icon;

  const content = (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card p-4 transition-colors',
        notification.read ? 'bg-white' : 'bg-brand-50 ring-1 ring-brand-200',
      )}
    >
      <span
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-tile', spec.tone)}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink-900">{notification.title}</p>
        <p className="mt-0.5 text-sm text-ink-500">{notification.body}</p>
        <p className="mt-1 text-xs text-ink-400">{formatRelative(notification.createdAt)}</p>
      </div>

      {!notification.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-label="Okunmadı" />
      )}
    </div>
  );

  if (!notification.link) return content;

  return (
    <Link
      to={notification.link}
      onClick={() => {
        if (!notification.read) markRead.mutate(notification.id);
      }}
      className="block"
    >
      {content}
    </Link>
  );
}
