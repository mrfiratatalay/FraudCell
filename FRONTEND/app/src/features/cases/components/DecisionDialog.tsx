import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet, TextAreaField, useToast } from '@/shared/ui';
import { isConcurrencyError } from '@/shared/api/errors';
import { useCurrentUser } from '@/features/authentication/useSession';
import { cn } from '@/shared/lib/cn';
import { useSubmitDecisionMutation } from '../mutations';

function buildSchema(requireOverrideReason: boolean) {
  return z
    .object({
      decision: z.enum(['APPROVE', 'BLOCK']),
      note: z.string().trim().optional(),
      overrideReason: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.decision === 'BLOCK' && !data.note) {
        ctx.addIssue({ code: 'custom', path: ['note'], message: 'Blokla kararı için not girmen gerekiyor.' });
      }
      if (requireOverrideReason && !data.overrideReason) {
        ctx.addIssue({
          code: 'custom',
          path: ['overrideReason'],
          message: 'Süpervizör kararı için gerekçe zorunludur.',
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

/**
 * Karar ver diyaloğu.
 *
 * DESIGN.MD kural 1: optimistic DEĞİL. Buton `mutation.isPending` sırasında
 * disabled kalır ve "Gönderiliyor…" yazar; cache yalnızca backend cevabı
 * geldikten sonra güncellenir (bkz. `case-cache.ts`).
 */
export function DecisionDialog({
  caseId,
  version,
  onConflict,
}: {
  caseId: string;
  version: number;
  onConflict: () => void;
}) {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();
  const requireOverrideReason = user.role === 'SUPERVISOR';
  const toast = useToast();
  const mutation = useSubmitDecisionMutation(caseId);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(requireOverrideReason)),
    defaultValues: { decision: 'APPROVE', note: '', overrideReason: '' },
  });

  const decision = watch('decision');

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      {
        ifMatch: version,
        body: {
          decision: values.decision,
          note: values.note || null,
          overrideReason: values.overrideReason || null,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
          toast.success(values.decision === 'APPROVE' ? 'İşlem onaylandı.' : 'İşlem bloklandı.');
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 items-center justify-center rounded-pill bg-danger-500 px-6 text-[15px] font-semibold text-white transition-[filter] hover:brightness-105"
      >
        Karar ver
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Vaka kararı"
        description="Karar verildikten sonra vaka analiste geri dönmez."
        footer={
          <>
            <button
              type="button"
              onClick={onSubmit}
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-12 flex-1 items-center justify-center rounded-pill px-6',
                'text-[15px] font-semibold text-white transition-[filter]',
                'disabled:pointer-events-none disabled:bg-ink-100 disabled:text-ink-400',
                decision === 'BLOCK' ? 'bg-danger-500 hover:bg-danger-700' : 'gradient-brand hover:brightness-105',
              )}
            >
              {mutation.isPending ? 'Gönderiliyor…' : decision === 'BLOCK' ? 'Blokla' : 'Onayla'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-pill border border-ink-200 px-6 text-[15px] font-semibold text-ink-700 hover:bg-ink-100"
            >
              Vazgeç
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['APPROVE', 'BLOCK'] as const).map((value) => (
              <label
                key={value}
                className={cn(
                  'flex-1 cursor-pointer rounded-tile border px-4 py-3 text-center text-sm font-semibold transition-colors',
                  decision === value
                    ? value === 'BLOCK'
                      ? 'border-danger-500 bg-danger-100 text-danger-700'
                      : 'border-brand-600 bg-brand-100 text-brand-800'
                    : 'border-ink-200 text-ink-500 hover:bg-ink-100',
                )}
              >
                <input type="radio" value={value} className="sr-only" {...register('decision')} />
                {value === 'APPROVE' ? 'Onayla' : 'Blokla'}
              </label>
            ))}
          </div>

          <TextAreaField
            label={decision === 'BLOCK' ? 'Karar notu (zorunlu)' : 'Karar notu (opsiyonel)'}
            error={errors.note?.message}
            {...register('note')}
          />

          {requireOverrideReason && (
            <TextAreaField
              label="Gerekçe (süpervizör kararı için zorunlu)"
              error={errors.overrideReason?.message}
              {...register('overrideReason')}
            />
          )}
        </div>
      </Sheet>
    </>
  );
}
