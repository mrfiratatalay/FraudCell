import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { submitCaseFeedback } from '@/features/cases/api';
import { queryKeys } from '@/shared/api/query-keys';
import { cn } from '@/shared/lib/cn';
import { Button, useToast } from '@/shared/ui';

const RATING_LABEL = ['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Çok iyi'];

interface CaseFeedbackCardProps {
  transactionId: string;
  caseId: string;
  /** Daha önce verilen puan; null ise form gösterilir. */
  rating: number | null;
}

/**
 * Case §4.6: vaka KAPANDI olunca müşteri süreci bir kez 1–5 yıldızla puanlar.
 * Tek seferlik kuralı backend'de (409); burada verilen puan salt okunur gösterilir.
 */
export function CaseFeedbackCard({ transactionId, caseId, rating }: CaseFeedbackCardProps) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: () =>
      submitCaseFeedback(caseId, { rating: selected, comment: comment.trim() || null }),
    onSuccess: () => {
      toast.success('Teşekkürler', 'Değerlendirmeniz kaydedildi.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.detail(transactionId) });
    },
    onError: (error) => toast.fromError(error, 'Değerlendirme gönderilemedi'),
  });

  const done = rating !== null;
  const shown = done ? rating : hovered || selected;

  return (
    <section className="surface-card p-5 lg:col-span-2" aria-labelledby="feedback-title">
      <h2 id="feedback-title" className="text-h3 text-ink-900">
        {done ? 'Değerlendirmeniz' : 'Süreci değerlendirin'}
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        {done
          ? 'Bu vaka için verdiğiniz puan. Her vaka yalnızca bir kez puanlanabilir.'
          : 'Vaka kapandı. İnceleme sürecinden ne kadar memnun kaldınız?'}
      </p>

      <div
        role={done ? 'img' : 'radiogroup'}
        aria-label={done ? `${rating} / 5 yıldız` : 'Puan'}
        className="mt-4 flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = value <= shown;
          const icon = (
            <Star
              className={cn('size-8', filled ? 'fill-warning-500 text-warning-500' : 'text-ink-300')}
              aria-hidden
            />
          );
          if (done) return <span key={value}>{icon}</span>;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected === value}
              aria-label={`${value} yıldız`}
              className="rounded-full p-0.5 focus-visible:outline-2 focus-visible:outline-brand-500"
              onMouseEnter={() => setHovered(value)}
              onClick={() => setSelected(value)}
            >
              {icon}
            </button>
          );
        })}
        {shown > 0 ? (
          <span className="ml-2 text-sm font-medium text-ink-700">{RATING_LABEL[shown]}</span>
        ) : null}
      </div>

      {!done ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit.mutate();
          }}
        >
          <label className="block text-sm text-ink-700">
            Yorum (isteğe bağlı)
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-tile border border-ink-200 bg-surface p-3 text-sm text-ink-900"
            />
          </label>
          <Button type="submit" disabled={selected === 0} loading={submit.isPending}>
            Değerlendirmeyi gönder
          </Button>
        </form>
      ) : null}
    </section>
  );
}
