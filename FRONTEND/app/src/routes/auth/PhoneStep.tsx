import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Field } from '@/shared/ui';
import { formatMsisdn } from '@/shared/lib/format';
import { AuthSubmit } from './AuthShell';

/**
 * Telefon numarası adımı.
 *
 * Numara "5XX XXX XX XX" maskesiyle gösterilir ama dışarı HAM 10 hane verilir;
 * backend boşluklu değeri beklemiyor.
 */
export function PhoneStep({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (gsmNumber: string) => void;
  loading: boolean;
  error?: string;
}) {
  const [value, setValue] = useState('');
  const digits = value.replace(/\D/g, '');
  const valid = digits.length === 10 && digits.startsWith('5');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(digits);
      }}
      className="flex min-h-[50vh] flex-col"
    >
      <Field
        label="Telefon Numarası"
        onBrand
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus
        placeholder="5XX XXX XX XX"
        value={formatMsisdn(value)}
        onChange={(e) => setValue(e.target.value)}
        leadingIcon={<Smartphone className="size-5" />}
        {...(error ? { error } : {})}
      />

      <div className="mt-auto pt-8">
        <AuthSubmit loading={loading} disabled={!valid}>
          Devam Et
        </AuthSubmit>
      </div>
    </form>
  );
}
