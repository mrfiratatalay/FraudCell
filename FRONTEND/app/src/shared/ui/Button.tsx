import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onBrand';
type Size = 'sm' | 'md' | 'lg';

/** Action hierarchy: one Turkcell-yellow primary per view, quiet bordered secondary, text-only ghost. */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-tc-500 text-night-900 font-semibold shadow-[inset_0_-1px_0_rgba(0,0,0,.08),0_1px_2px_rgba(0,19,49,.18)] hover:bg-tc-400 active:bg-tc-600',
  secondary:
    'bg-surface text-ink-900 border border-line shadow-card hover:bg-subtle hover:border-ink-300 active:bg-ink-100',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
  danger:
    'bg-critical-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14)] hover:bg-critical-700 active:brightness-95 [[data-theme=dark]_&]:bg-critical-500',
  onBrand: 'bg-tc-500 text-night-900 font-semibold shadow-raised hover:bg-tc-400 active:bg-tc-600',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      // Yükleniyorken ekran okuyucuya durumu bildir.
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-control font-medium whitespace-nowrap select-none',
        'transition-[filter,background-color,border-color,color,transform] duration-150 active:scale-[0.98]',
        // Disabled: flat grey fill, grey text.
        'disabled:pointer-events-none disabled:bg-none disabled:bg-ink-100',
        'disabled:text-ink-400 disabled:shadow-none disabled:border-transparent',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        leadingIcon && <span aria-hidden>{leadingIcon}</span>
      )}
      {children}
      {!loading && trailingIcon && <span aria-hidden>{trailingIcon}</span>}
    </button>
  );
});
