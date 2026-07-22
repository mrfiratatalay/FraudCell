import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, ConfirmDialog, TextAreaField, useToast } from '@/shared/ui';
import { isConcurrencyError } from '@/shared/api/errors';
import { useReassignmentMutation } from '../mutations';

// TODO: `GET /staff` (Identity Service — A tarafı) hazır olunca listeyi oradan çek.
const DEMO_ANALYSTS = [
  { id: 'usr_analyst_1', label: 'Deniz Kaya' },
  { id: 'usr_analyst_2', label: 'Emre Yıldız' },
];

const schema = z.object({
  newAnalystId: z.string().min(1, 'Analist seçmelisin.'),
  reason: z.string().trim().min(3, 'Gerekçe girmelisin.'),
});
type FormValues = z.infer<typeof schema>;

export function ReassignmentDialog({
  caseId,
  version,
  currentAnalystId,
  onConflict,
}: {
  caseId: string;
  version: number;
  currentAnalystId: string | null;
  onConflict: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useReassignmentMutation(caseId);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { newAnalystId: '', reason: '' } });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { ifMatch: version, body: { newAnalystId: values.newAnalystId, reason: values.reason } },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
          toast.success('Vaka devredildi.');
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
        Başka analiste devret
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Vakayı devret"
        description="Vaka seçilen analiste devredilecek."
        confirmLabel="Devret"
        loading={mutation.isPending}
        onConfirm={onSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Yeni analist</label>
            <select
              {...register('newAnalystId')}
              className="h-10 w-full rounded-tile border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
            >
              <option value="">Seçiniz</option>
              {DEMO_ANALYSTS.filter((a) => a.id !== currentAnalystId).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            {errors.newAnalystId && (
              <p className="mt-1 text-sm text-danger-500">{errors.newAnalystId.message}</p>
            )}
          </div>

          <TextAreaField label="Gerekçe" error={errors.reason?.message} {...register('reason')} />
        </div>
      </ConfirmDialog>
    </>
  );
}
