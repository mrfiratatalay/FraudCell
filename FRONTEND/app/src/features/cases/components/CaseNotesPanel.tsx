import { useState } from 'react';
import { Button, EmptyState, ErrorState, SkeletonList, TextAreaField, useToast } from '@/shared/ui';
import { formatDateTime } from '@/shared/lib/format';
import { useAddNoteMutation } from '../mutations';
import { useCaseNotesQuery } from '../queries';

export function CaseNotesPanel({ caseId }: { caseId: string }) {
  const notesQuery = useCaseNotesQuery(caseId);
  const addNote = useAddNoteMutation(caseId);
  const toast = useToast();
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (!text.trim()) return;
    addNote.mutate(text, {
      onSuccess: () => setText(''),
      onError: (error) => toast.fromError(error),
    });
  };

  return (
    <div className="space-y-4">
      <TextAreaField
        label="Not ekle"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Düz metin — HTML kabul edilmez."
      />
      <Button size="sm" onClick={handleAdd} loading={addNote.isPending} disabled={!text.trim()}>
        Ekle
      </Button>

      {notesQuery.isLoading ? (
        <SkeletonList rows={2} />
      ) : notesQuery.isError ? (
        <ErrorState error={notesQuery.error} onRetry={() => void notesQuery.refetch()} />
      ) : notesQuery.data && notesQuery.data.length > 0 ? (
        <ul className="space-y-3">
          {notesQuery.data.map((note) => (
            <li key={note.noteId} className="surface-card p-3">
              <p className="text-sm text-ink-900">{note.text}</p>
              <p className="mt-1 text-xs text-ink-400">{formatDateTime(note.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Henüz not yok" />
      )}
    </div>
  );
}
