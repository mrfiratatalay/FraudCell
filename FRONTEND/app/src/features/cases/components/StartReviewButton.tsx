import { useState } from 'react';
import { Button, ConfirmDialog, useToast } from '@/shared/ui';
import { isConcurrencyError } from '@/shared/api/errors';
import { useStartReviewMutation } from '../mutations';

export function StartReviewButton({
  caseId,
  version,
  onConflict,
}: {
  caseId: string;
  version: number;
  onConflict: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useStartReviewMutation(caseId);
  const toast = useToast();

  return (
    <>
      <Button onClick={() => setOpen(true)}>İncelemeye al</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Vakayı incelemeye al"
        description="Vaka durumu 'İnceleniyor' olarak güncellenecek."
        confirmLabel="İncelemeye al"
        loading={mutation.isPending}
        onConfirm={() =>
          mutation.mutate(version, {
            onSuccess: () => {
              setOpen(false);
              toast.success('Vaka incelemeye alındı.');
            },
            onError: (error) => {
              if (isConcurrencyError(error)) {
                setOpen(false);
                onConflict();
                return;
              }
              toast.fromError(error);
            },
          })
        }
      />
    </>
  );
}
