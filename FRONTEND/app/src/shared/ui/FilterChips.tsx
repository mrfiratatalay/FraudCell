import { cn } from '@/shared/lib/cn';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Tekli-seçim çip filtresi.
 *
 * Seçili değer üst bileşenden gelir ve URL search param'ına bağlanmalıdır
 *: `undefined` → "Tümü". Bileşen kendi
 * state'ini tutmaz; seçimi `onChange` ile yukarı bildirir.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'Tümü',
  className,
}: {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  allLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('scroll-slim -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5', className)} role="group">
      <Chip active={value === undefined} onClick={() => onChange(undefined)}>
        {allLabel}
      </Chip>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Chip
            key={option.value}
            active={active}
            onClick={() => onChange(active ? undefined : option.value)}
          >
            {option.label}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
        active
          ? 'bg-ink-900 text-surface'
          : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
      )}
    >
      {children}
    </button>
  );
}
