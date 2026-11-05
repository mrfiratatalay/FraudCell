import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  /** Son hane girildiğinde otomatik gönderim için. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  label?: string;
}

/**
 * Haneli kod girişi — SMS OTP için.
 * Tek bir kontrollü string tutar; kutular yalnızca görünümdür.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
  label = 'Doğrulama kodu',
}: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const completedFor = useRef<string | null>(null);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    // Aynı değer için onComplete'i tekrar tetikleme.
    if (value.length === length && completedFor.current !== value) {
      completedFor.current = value;
      onComplete?.(value);
    }
    if (value.length < length) completedFor.current = null;
  }, [value, length, onComplete]);

  function setDigit(index: number, digit: string) {
    const next = value.padEnd(length, ' ').split('');
    next[index] = digit;
    onChange(next.join('').replace(/ /g, '').slice(0, length));
  }

  function handleInput(index: number, raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;

    if (digits.length > 1) {
      // Yapıştırma ya da SMS otomatik doldurma: baştan itibaren yaz.
      onChange(digits.slice(0, length));
      inputs.current[Math.min(digits.length, length - 1)]?.focus();
      return;
    }

    setDigit(index, digits);
    if (index < length - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        inputs.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < length - 1) inputs.current[index + 1]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(digits);
    inputs.current[Math.min(digits.length, length - 1)]?.focus();
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2.5">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          // İlk kutuya SMS otomatik doldurma ipucu ver.
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          disabled={disabled}
          value={value[index] ?? ''}
          aria-label={`${index + 1}. hane`}
          onChange={(e) => handleInput(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-12 rounded-control border bg-surface text-center shadow-card sm:w-14',
            'font-mono text-2xl font-medium text-ink-900 tabular',
            'transition-[border-color,box-shadow] duration-150',
            'focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none',
            'disabled:bg-ink-100 disabled:text-ink-400',
            error ? 'border-danger-500' : 'border-line',
          )}
        />
      ))}
    </div>
  );
}
