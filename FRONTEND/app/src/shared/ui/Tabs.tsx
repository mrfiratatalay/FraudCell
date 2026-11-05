import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** Sekme etiketinin yanındaki sayaç — "Vakalarım 4" gibi. */
  count?: number;
}

/**
 * Sekme çubuğu.
 *
 * URL'e bağlı sekmelerde (vaka kuyruğu durumu gibi) `value`/`onValueChange`
 * TanStack Router'ın typed search param'ına bağlanmalıdır; sekme seçimi
 * bileşen state'inde tutulursa sayfa yenilenince kaybolur ve paylaşılan link
 * yanlış sekmeyi açar.
 */
export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  children,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      className={className}
    >
      <RadixTabs.List
        className={cn(
          'flex gap-5 overflow-x-auto border-b border-line',
          // No visible scrollbar when the tabs scroll sideways.
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'relative shrink-0 py-2.5 text-[13px] font-medium whitespace-nowrap',
              'text-ink-500 transition-colors hover:text-ink-900',
              'data-[state=active]:text-ink-900',
              // Turkcell-yellow underline under the active tab.
              'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full',
              'after:bg-transparent data-[state=active]:after:bg-tc-500',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'ml-1.5 rounded px-1.5 py-0.5 text-[11px] tabular',
                  'bg-ink-100 text-ink-500',
                )}
              >
                {item.count}
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = RadixTabs.Content;
