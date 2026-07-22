import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Zap } from 'lucide-react';
import { Banner, Button, Card, Field, SectionTitle } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { messageFor } from '@/shared/api/errors';
import {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABEL,
  type TransactionType,
} from '@/shared/api/enums';
import type { CreateTransactionBody } from '@/shared/api/contract';
import { newIdempotencyKey } from '@/features/transactions/api';
import { useCreateTransaction } from '@/features/transactions/hooks';

/**
 * Yeni işlem oluşturma (UX-CUS-002).
 *
 * Demo senaryosu (DEMO-002) gece + yurt dışı + yüksek tutar kombinasyonunu
 * gerektirdiği için hazır bir "riskli işlem" ön ayarı var; jüri sunumunda
 * alanları tek tek doldurmakla vakit kaybedilmesin.
 */

const schema = z.object({
  amount: z
    .number({ message: 'Tutar gir.' })
    .positive('Tutar sıfırdan büyük olmalı.')
    .max(1_000_000, 'Tutar çok yüksek.'),
  transactionType: z.enum(TRANSACTION_TYPES),
  recipient: z.string().trim().min(2, 'Alıcı bilgisi gir.').max(120),
  city: z.string().trim().min(2, 'Şehir gir.').max(80),
  countryCode: z
    .string()
    .trim()
    .length(2, 'İki harfli ülke kodu gir (TR, RU, DE...).')
    .transform((v) => v.toUpperCase()),
});

type Values = z.input<typeof schema>;

export function NewTransaction() {
  const navigate = useNavigate();
  const create = useCreateTransaction();
  const [preset, setPreset] = useState(false);

  /**
   * Idempotency anahtarı form başına ÜRETİLİR ve saklanır.
   *
   * Her `mutate` çağrısında yeniden üretilseydi, ağ hatasından sonra "tekrar
   * dene" ikinci bir işlem yaratırdı. Aynı anahtarla tekrar gönderim
   * backend'de ilk yanıtı oynatır.
   */
  const idempotencyKey = useRef(newIdempotencyKey());

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined,
      transactionType: 'TRANSFER',
      recipient: '',
      city: 'İstanbul',
      countryCode: 'TR',
    },
  });

  const selectedType = form.watch('transactionType');

  /** DEMO-002: gece, yurt dışı, yüksek tutarlı işlem. */
  const applyRiskyPreset = () => {
    const night = new Date();
    night.setHours(3, 12, 0, 0);

    form.setValue('amount', 62_000);
    form.setValue('transactionType', 'CEKIM');
    form.setValue('recipient', 'ATM-9931');
    form.setValue('city', 'Moskova');
    form.setValue('countryCode', 'RU');
    setPreset(true);
  };

  const submit = form.handleSubmit((raw) => {
    const values = schema.parse(raw);

    // Ön ayar seçiliyse işlem saatini geceye alıyoruz; aksi hâlde şimdi.
    const occurred = new Date();
    if (preset) occurred.setHours(3, 12, 0, 0);

    const body: CreateTransactionBody = {
      amount: values.amount,
      currency: 'TRY',
      transactionType: values.transactionType,
      recipient: { reference: values.recipient },
      // Cihaz parmak izi gerçekte cihazdan toplanır; burada oturum başına sabit.
      device: { fingerprint: navigator.userAgent.slice(0, 64) },
      location: { city: values.city, countryCode: values.countryCode },
      occurredAt: occurred.toISOString(),
    };

    create.mutate(
      { body, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: (result) => {
          void navigate({
            to: '/customer/transactions/$transactionId',
            params: { transactionId: result.transactionId },
          });
        },
      },
    );
  });

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void navigate({ to: '/customer/transactions' })}
          aria-label="Geri"
          className="-ml-2 rounded-full p-2 text-ink-500 transition-colors hover:bg-ink-100"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold text-ink-900">Yeni İşlem</h1>
      </div>

      {create.error && (
        <Banner tone="danger" className="mb-4">
          {messageFor(create.error)}
        </Banner>
      )}

      <form onSubmit={submit} className="space-y-5">
        {/* --------------------------------------------------- işlem tipi -- */}
        <div>
          <SectionTitle>İşlem Tipi</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TRANSACTION_TYPES.map((type) => (
              <TypeChip
                key={type}
                type={type}
                active={selectedType === type}
                onClick={() => form.setValue('transactionType', type)}
              />
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------ alanlar -- */}
        <Card className="space-y-4">
          <Field
            label="Tutar (TL)"
            type="number"
            inputMode="decimal"
            step="0.01"
            autoFocus
            placeholder="0,00"
            {...form.register('amount', { valueAsNumber: true })}
            {...(form.formState.errors.amount
              ? { error: form.formState.errors.amount.message }
              : {})}
          />

          <Field
            label="Alıcı"
            placeholder="IBAN, ATM kodu ya da fatura adı"
            {...form.register('recipient')}
            {...(form.formState.errors.recipient
              ? { error: form.formState.errors.recipient.message }
              : {})}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Şehir"
              {...form.register('city')}
              {...(form.formState.errors.city
                ? { error: form.formState.errors.city.message }
                : {})}
            />
            <Field
              label="Ülke kodu"
              maxLength={2}
              placeholder="TR"
              hint="İki harf: TR, RU, DE…"
              className="uppercase"
              {...form.register('countryCode')}
              {...(form.formState.errors.countryCode
                ? { error: form.formState.errors.countryCode.message }
                : {})}
            />
          </div>
        </Card>

        {/* -------------------------------------------------- demo ön ayar -- */}
        <button
          type="button"
          onClick={applyRiskyPreset}
          className={cn(
            'flex w-full items-start gap-3 rounded-card border border-dashed p-4 text-left',
            'transition-colors',
            preset
              ? 'border-warning-500 bg-warning-100'
              : 'border-ink-200 bg-white hover:border-warning-500 hover:bg-warning-100/40',
          )}
        >
          <span className="mt-0.5 text-warning-700" aria-hidden>
            <Zap className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-ink-900">
              Riskli işlem ön ayarı
            </span>
            <span className="mt-0.5 block text-sm text-ink-500">
              Gece 03:12, Moskova (RU), 62.000 TL nakit çekim — yüksek risk üretir.
            </span>
          </span>
        </button>

        <Button type="submit" fullWidth size="lg" loading={create.isPending}>
          İşlemi Oluştur
        </Button>

        <p className="text-center text-sm text-ink-400">
          İşlem oluşturulduktan sonra yapay zekâ değerlendirmesi arka planda çalışır.
        </p>
      </form>
    </div>
  );
}

function TypeChip({
  type,
  active,
  onClick,
}: {
  type: TransactionType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-tile px-3 py-3 text-sm font-semibold transition-colors',
        active
          ? 'bg-brand-700 text-white'
          : 'bg-white text-ink-500 ring-1 ring-ink-200 hover:bg-ink-100',
      )}
    >
      {TRANSACTION_TYPE_LABEL[type]}
    </button>
  );
}
