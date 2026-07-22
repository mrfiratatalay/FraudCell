import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, ConfirmDialog, TextAreaField, useToast } from '@/shared/ui';
import { isConcurrencyError } from '@/shared/api/errors';
import { FRAUD_TYPE_LABEL, FRAUD_TYPES } from '@/shared/api/enums';
import { useFraudTypeOverrideMutation } from '../mutations';

const schema = z.object({
  fraudType: z.enum(FRAUD_TYPES),
  reason: z.string().trim().min(3, 'Gerekçe girmelisin.'),
});
type FormValues = z.infer<typeof schema>;

export function FraudTypeOverrideDialog({
  caseId,
  version,
  currentFraudType,
  onConflict,
}: {
  caseId: string;
  version: number;
  currentFraudType: (typeof FRAUD_TYPES)[number] | null;
  onConflict: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useFraudTypeOverrideMutation(caseId);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fraudType: currentFraudType ?? 'TEMIZ', reason: '' },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { ifMatch: version, body: { fraudType: values.fraudType, reason: values.reason } },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
          toast.success('Fraud türü güncellendi.');
        },
        onError: (error) => {
          if (isConcurrencyError(error)) {
            setOpen(false);
            onConflict();
            return;
          }
          toast.fromError(error);
        },
      },
    );
  });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Fraud tipini değiştir
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Fraud tipini override et"
        description="AI'ın tahmini değişmez, yalnızca yürürlükteki değer güncellenir."
        confirmLabel="Kaydet"
        loading={mutation.isPending}
        onConfirm={onSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Fraud tipi</label>
            <select
              {...register('fraudType')}
              className="h-10 w-full rounded-tile border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
            >
              {FRAUD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FRAUD_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </div>

          <TextAreaField label="Gerekçe" error={errors.reason?.message} {...register('reason')} />
        </div>
      </ConfirmDialog>
    </>
  );
}
