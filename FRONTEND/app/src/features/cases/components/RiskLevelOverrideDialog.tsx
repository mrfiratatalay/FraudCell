import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, ConfirmDialog, TextAreaField, useToast } from '@/shared/ui';
import { isConcurrencyError } from '@/shared/api/errors';
import { RISK_LEVEL_LABEL, RISK_LEVELS } from '@/shared/api/enums';
import { useRiskLevelOverrideMutation } from '../mutations';

const schema = z.object({
  riskLevel: z.enum(RISK_LEVELS),
  reason: z.string().trim().min(3, 'Gerekçe girmelisin.'),
});
type FormValues = z.infer<typeof schema>;

export function RiskLevelOverrideDialog({
  caseId,
  version,
  currentRiskLevel,
  onConflict,
}: {
  caseId: string;
  version: number;
  currentRiskLevel: (typeof RISK_LEVELS)[number] | null;
  onConflict: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useRiskLevelOverrideMutation(caseId);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { riskLevel: currentRiskLevel ?? 'ORTA', reason: '' },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { ifMatch: version, body: { riskLevel: values.riskLevel, reason: values.reason } },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
          toast.success('Risk seviyesi güncellendi, SLA yeniden hesaplandı.');
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
        Risk seviyesini değiştir
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Risk seviyesini override et"
        description="Risk seviyesi değişince SLA süresi yeniden başlar."
        confirmLabel="Kaydet"
        loading={mutation.isPending}
        onConfirm={onSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">Risk seviyesi</label>
            <select
              {...register('riskLevel')}
              className="h-10 w-full rounded-tile border border-ink-200 bg-white px-3 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none"
            >
              {RISK_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {RISK_LEVEL_LABEL[level]}
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
