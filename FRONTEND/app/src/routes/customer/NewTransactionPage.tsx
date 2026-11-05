import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { MapPin, Send, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createTransaction } from '@/features/transactions/api';
import { newIdempotencyKey } from '@/shared/api/client';
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABEL } from '@/shared/api/enums';
import { messageFor } from '@/shared/api/errors';
import { Banner, Button, CustomerPageHeader, Field } from '@/shared/ui';

const schema = z.object({
  amount: z.string().trim().refine((value) => Number(value) > 0, 'Sıfırdan büyük bir tutar gir.'),
  transactionType: z.enum(TRANSACTION_TYPES),
  recipientReference: z.string().trim().min(2, 'Alıcı referansı zorunludur.'),
  city: z.string().trim().min(2, 'Şehir zorunludur.'),
  countryCode: z.string().trim().length(2, 'İki harfli ülke kodu gir.'),
});

type FormValues = z.infer<typeof schema>;

function getDeviceFingerprint(): string {
  const storageKey = 'fraudcell-device-fingerprint';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const created = `web-${crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, created);
  return created;
}

export function NewTransactionPage() {
  const navigate = useNavigate();
  const idempotencyKey = useRef(newIdempotencyKey());
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      transactionType: 'TRANSFER',
      recipientReference: '',
      city: 'İstanbul',
      countryCode: 'TR',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setRequestError(null);
    try {
      const transaction = await createTransaction(
        {
          amount: Number(values.amount),
          currency: 'TRY',
          transactionType: values.transactionType,
          recipient: { reference: values.recipientReference },
          device: { fingerprint: getDeviceFingerprint() },
          location: { city: values.city, countryCode: values.countryCode.toUpperCase() },
          occurredAt: new Date().toISOString(),
        },
        idempotencyKey.current,
      );
      await navigate({
        to: '/customer/transactions/$transactionId',
        params: { transactionId: transaction.transactionId },
        replace: true,
      });
    } catch (error) {
      setRequestError(messageFor(error));
    }
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:py-10">
      <CustomerPageHeader title="Yeni işlem" description="Gönderdiğin anda risk skorlanır; şüpheli görünürse işlem incelemeye alınır." />

      <form onSubmit={onSubmit} className="surface-panel space-y-5 p-5 sm:p-6" noValidate>
        {requestError ? <Banner tone="danger">{requestError}</Banner> : null}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-700">İşlem türü</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TRANSACTION_TYPES.map((type) => (
              <label key={type} className="cursor-pointer">
                <input type="radio" value={type} className="peer sr-only" {...register('transactionType')} />
                <span className="flex h-10 items-center justify-center rounded-control border border-line bg-surface text-[13px] font-medium text-ink-600 shadow-card transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700 peer-focus-visible:ring-3 peer-focus-visible:ring-brand-500/25 hover:border-ink-300">
                  {TRANSACTION_TYPE_LABEL[type]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label="Tutar (TRY)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          leadingIcon={<span className="text-sm font-medium text-ink-500">₺</span>}
          error={errors.amount?.message}
          {...register('amount')}
        />

        <Field
          label="Alıcı referansı"
          placeholder="TR00 0000 veya kullanıcı referansı"
          leadingIcon={<UserRound />}
          error={errors.recipientReference?.message}
          {...register('recipientReference')}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <Field
            label="Şehir"
            leadingIcon={<MapPin />}
            error={errors.city?.message}
            {...register('city')}
          />
          <Field
            label="Ülke"
            maxLength={2}
            error={errors.countryCode?.message}
            {...register('countryCode')}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          leadingIcon={<Send className="size-4" />}
        >
          İşlemi gönder
        </Button>
      </form>
    </div>
  );
}
