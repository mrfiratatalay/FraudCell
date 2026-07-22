import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ConfirmDialog, TextAreaField, useToast } from '@/shared/ui';
import { isConcurrencyError } from '@/shared/api/errors';
import { useManualAssignmentMutation } from '../mutations';

// TODO: `GET /staff` (Identity Service — A tarafı) hazır olunca listeyi
// oradan çek. Mock modda `mocks/db.ts`'teki analistlerle bire bir eşleşir.
const DEMO_ANALYSTS = [
  { id: 'usr_analyst_1', label: 'Deniz Kaya' },
  { id: 'usr_analyst_2', label: 'Emre Yıldız' },
];

const schema = z.object({
  analystId: z.string().min(1, 'Analist seçmelisin.'),
  reason: z.string().trim().min(3, 'Gerekçe girmelisin.'),
});
type FormValues = z.infer<typeof schema>;

export function ManualAssignmentDialog({
  open,
  onOpenChange,
  caseId,
  version,
  onConflict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  version: number;
  onConflict: () => void;
}) {
  const mutation = useManualAssignmentMutation(caseId);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { analystId: '', reason: '' } });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { ifMatch: version, body: { analystId: values.analystId, reason: values.reason } },
      {
        onSuccess: () => {
          onOpenChange(false);
          reset();
          toast.success('Vaka atandı.');
        },
        onError: (error) => {
          if (isConcurrencyError(error)) {
            onOpenChange(false);
            onConflict();
            return;
          }
          toast.fromError(error);
        },
      },
    );
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Manuel atama"
      description="Vaka seçilen analiste atanacak."
      confirmLabel="Ata"
      loading={mutation.isPending}
      onConfirm={onSubmit}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">Analist</label>
          <select
            {...register('analystId')}
            className="h-10 w-full rounded-tile border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
          >
            <option value="">Seçiniz</option>
            {DEMO_ANALYSTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {errors.analystId && <p className="mt-1 text-sm text-danger-500">{errors.analystId.message}</p>}
        </div>

        <TextAreaField label="Gerekçe" error={errors.reason?.message} {...register('reason')} />
      </div>
    </ConfirmDialog>
  );
}
