import { useState } from 'react';
import { Button, ConfirmDialog, TextAreaField, useToast } from '@/shared/ui';
import { isConcurrencyError } from '@/shared/api/errors';
import { useRequestVerificationMutation } from '../mutations';

export function RequestVerificationDialog({
  caseId,
  version,
  onConflict,
}: {
  caseId: string;
  version: number;
  onConflict: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const mutation = useRequestVerificationMutation(caseId);
  const toast = useToast();

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Doğrulama iste
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Müşteriden doğrulama iste"
        description="Müşteriye bu işlemi yapıp yapmadığı sorulacak. Vaka 'Müşteri Doğrulama' durumuna geçer."
        confirmLabel="Doğrulama iste"
        loading={mutation.isPending}
        onConfirm={() =>
          mutation.mutate(
            { ifMatch: version, body: { message: message.trim() || null } },
            {
              onSuccess: () => {
                setOpen(false);
                setMessage('');
                toast.success('Doğrulama isteği gönderildi.');
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
          )
        }
      >
        <TextAreaField
          label="Not (opsiyonel)"
          hint="Müşteriye gösterilecek ek açıklama."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </ConfirmDialog>
    </>
  );
}
