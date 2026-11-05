import { cn } from '@/shared/lib/cn';
import { initials } from '@/shared/lib/format';

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
};

/**
 * İsim baş harflerinden üretilen avatar.
 *
 * Fotoğraf yok; ada göre stabil bir marka tonu seçilir ki aynı kişi her yerde
 * aynı renkte görünsün. `initials` tek kaynaktır (format.ts).
 */
const PALETTE = [
  'bg-brand-100 text-brand-800',
  'bg-aqua-50 text-aqua-700',
  'bg-success-100 text-success-700',
  'bg-tc-100 text-warning-700',
  'bg-brand-50 text-brand-700',
] as const;

function paletteFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? PALETTE[0];
}

export function Avatar({
  name,
  size = 'md',
  onDark = false,
  className,
}: {
  name: string;
  size?: AvatarSize;
  /** Koyu kenar çubuğunda kullanılırken cam efekti verir. */
  onDark?: boolean;
  className?: string;
}) {
  const label = initials(name) || '?';
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        onDark ? 'bg-white/12 text-white ring-1 ring-white/20' : paletteFor(name),
        SIZES[size],
        className,
      )}
    >
      {label}
    </span>
  );
}
