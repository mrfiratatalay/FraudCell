import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  /** Gradient arkaplan üzerinde duran alan — kenarlık yerine gölge kullanır. */
  onBrand?: boolean;
}

/**
 * Metin alanı: beyaz kart, etiket alanın içinde üstte küçük punto,
 * değer altında büyük punto. Kenarlık yok, yumuşak köşe.
 *
 * `forwardRef` React Hook Form'un `register()` dönüşünü bağlayabilmesi için
 * şarttır; `error` prop'u da `formState.errors[...].message` ile doldurulur.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, leadingIcon, trailingSlot, onBrand = false, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      <div
        className={cn(
          'flex min-h-16 items-center gap-3 rounded-tile bg-white px-4 py-2.5',
          'transition-[box-shadow,border-color,transform] duration-150',
          onBrand ? 'shadow-raised' : 'border border-ink-200 shadow-[0_4px_14px_rgba(0,31,77,.035)]',
          // Alan odaklandığında kenarlığı markaya çevir — focus-within içteki input'u yakalar.
          'focus-within:-translate-y-px focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/15',
          error && 'border-danger-500 focus-within:border-danger-500 focus-within:ring-danger-500/20',
          className,
        )}
      >
        {leadingIcon && <span className="shrink-0 text-ink-400">{leadingIcon}</span>}

        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="block text-xs font-medium text-ink-500">
            {label}
          </label>
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'min-h-6 w-full bg-transparent text-base text-ink-900 sm:text-[17px]',
              'placeholder:text-ink-400 focus:outline-none',
            )}
            {...rest}
          />
        </div>

        {trailingSlot}
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 px-1 text-sm text-danger-500">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 px-1 text-sm text-ink-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/** Göz ikonuyla açılıp kapanan şifre alanı — tasarımdaki "Şifre Oluştur" ekranı. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, 'type'>>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <Field
        ref={ref}
        type={visible ? 'text' : 'password'}
        trailingSlot={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            {visible ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
          </button>
        }
        {...props}
      />
    );
  },
);

/** Çok satırlı not alanı — analist karar notu, override gerekçesi. */
export interface TextAreaFieldProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, hint, error, className, id, ...rest }, ref) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

    return (
      <div className="w-full">
        <div
          className={cn(
            'rounded-tile border border-ink-200 bg-white px-4 py-3 shadow-[0_4px_14px_rgba(0,31,77,.035)]',
            'focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/15',
            error &&
              'border-danger-500 focus-within:border-danger-500 focus-within:ring-danger-500/20',
            className,
          )}
        >
          <label htmlFor={fieldId} className="block text-xs font-medium text-ink-500">
            {label}
          </label>
          <textarea
            ref={ref}
            id={fieldId}
            rows={3}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full resize-y bg-transparent text-[15px] leading-relaxed text-ink-900',
              'placeholder:text-ink-400 focus:outline-none',
            )}
            {...rest}
          />
        </div>

        {error ? (
          <p id={`${fieldId}-error`} role="alert" className="mt-1.5 px-1 text-sm text-danger-500">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="mt-1.5 px-1 text-sm text-ink-400">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

/** Kural listesi — "6 karakterden ve sadece rakamlardan oluşmalıdır." */
export function RuleList({ rules }: { rules: { text: string; met: boolean }[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {rules.map((rule) => (
        <li
          key={rule.text}
          className={cn(
            'flex items-start gap-2 text-sm',
            rule.met ? 'text-success-700' : 'text-ink-400',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border text-[10px]',
              rule.met ? 'border-success-500 bg-success-500 text-white' : 'border-ink-200',
            )}
          >
            {rule.met ? '✓' : ''}
          </span>
          {rule.text}
        </li>
      ))}
    </ul>
  );
}
