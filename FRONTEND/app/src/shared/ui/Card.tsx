import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** İç boşluğu kaldırır — liste satırları kendi padding'ini yönetsin diye. */
  flush?: boolean;
  /** Sol kenarda renkli şerit (risk seviyesi vurgusu için). */
  rail?: string;
}

export function Card({ flush = false, rail, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'surface-card relative overflow-hidden transition-[box-shadow,border-color] duration-200',
        !flush && 'p-5',
        rail && 'pl-6',
        className,
      )}
      {...rest}
    >
      {rail && <span className={cn('absolute inset-y-3 left-0 w-[3px] rounded-r-full', rail)} aria-hidden />}
      {children}
    </div>
  );
}
