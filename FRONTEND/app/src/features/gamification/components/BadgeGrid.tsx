import { Award } from 'lucide-react';
import type { BadgeResponse } from '@/shared/api/contract-pending';
import { Card } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';

export function BadgeGrid({ badges }: { badges: BadgeResponse[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {badges.map((badge) => {
        const earned = badge.earnedAt !== null;
        return (
          <Card key={badge.code} className={cn('text-center', !earned && 'opacity-60')}>
            <Award className={cn('mx-auto size-8', earned ? 'text-warning-500' : 'text-ink-300')} aria-hidden />
            <p className="mt-2 text-sm font-semibold text-ink-900">{badge.name}</p>
            <p className="mt-1 text-xs text-ink-500">{badge.description}</p>
            <p className="mt-1 text-xs font-semibold text-ink-400">{badge.progressLabel}</p>
          </Card>
        );
      })}
    </div>
  );
}
