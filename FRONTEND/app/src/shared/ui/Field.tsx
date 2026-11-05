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
 * Text field: label above, a bordered input with an optional leading icon.
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
      <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ink-700">
        {label}
      </label>
      <div
        className={cn(
          'flex h-11 items-center gap-2.5 rounded-control border bg-surface px-3',
          'transition-[box-shadow,border-color] duration-150',
          onBrand ? 'border-transparent shadow-raised' : 'border-line shadow-card hover:border-ink-300',
          'focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/20 focus-within:hover:border-brand-500',
          error && 'border-danger-500 focus-within:border-danger-500 focus-within:ring-danger-500/20',
          className,
        )}
      >
        {leadingIcon && <span className="shrink-0 text-ink-400 [&_svg]:size-4">{leadingIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none sm:text-sm"
          {...rest}
        />
        {trailingSlot}
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-[13px] text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-[13px] text-ink-500">
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
            className="-mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
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
        <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-medium text-ink-700">
          {label}
        </label>
        <textarea
          ref={ref}
          id={fieldId}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'block w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 shadow-card',
            'text-sm leading-relaxed text-ink-900 placeholder:text-ink-400',
            'transition-[box-shadow,border-color] hover:border-ink-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20',
            className,
          )}
          {...rest}
        />

        {error ? (
          <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-[13px] text-danger-600">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="mt-1.5 text-[13px] text-ink-500">
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
