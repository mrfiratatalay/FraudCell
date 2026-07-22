import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Ban, Cpu, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import {
  Banner,
  Card,
  ErrorState,
  RiskGauge,
  SectionTitle,
  Skeleton,
  ToneBadge,
} from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { formatDateTime, formatMoney } from '@/shared/lib/format';
import { DISPLAY_RISK_LABEL, riskTone } from '@/shared/lib/risk';
import {
  CONTROL_STATUS_LABEL,
  FRAUD_TYPE_LABEL,
  SCREENING_DECISION_LABEL,
  TRANSACTION_TYPE_LABEL,
} from '@/shared/api/enums';
import type { AssessmentResponse, ReasonCodeResponse } from '@/shared/api/contract';
import { useTransaction } from '@/features/transactions/hooks';

/**
 * İşlem detayı — AI skorunu, fraud türünü ve kararı gösterir
 * (UX-CUS-003) ve vaka sonucunu takip ettirir (UX-CUS-006).
 */
export function TransactionDetail() {
  const navigate = useNavigate();
  const { transactionId } = useParams({ from: '/customer/transactions/$transactionId' });
  const query = useTransaction(transactionId);

  return (
    <div className="px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void navigate({ to: '/customer/transactions' })}
          aria-label="Geri"
          className="-ml-2 rounded-full p-2 text-ink-500 transition-colors hover:bg-ink-100"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-xl font-bold text-ink-900">İşlem Detayı</h1>
      </div>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Detail data={query.data} />
      )}
    </div>
  );
}

function Detail({ data }: { data: NonNullable<ReturnType<typeof useTransaction>['data']> }) {
  const { assessment } = data;
  const pending = assessment.status === 'PENDING';
  const failed = assessment.status === 'FAILED' || assessment.status === 'TIMED_OUT';
  const blocked =
    data.controlStatus === 'BLOCKED' || data.controlStatus === 'TEMPORARILY_BLOCKED';

  const level = assessment.riskLevel ?? 'BELIRSIZ';
  const tone = riskTone(level);

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 lg:items-start">
      {/* ------------------------------------------------------ tutar/özet -- */}
      <Card className="lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-ink-500">{data.transactionNo}</p>
            <p className="mt-1 text-3xl font-bold tabular text-ink-900">
              {formatMoney(data.amount, data.currency)}
            </p>
            <p className="mt-1 text-[15px] text-ink-700">
              {TRANSACTION_TYPE_LABEL[data.transactionType]} · {data.recipient.reference}
            </p>
          </div>

          <ToneBadge
            toneClass={
              blocked ? 'bg-critical-100 text-critical-700' : 'bg-success-100 text-success-700'
            }
          >
            {blocked ? <Ban className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
            {CONTROL_STATUS_LABEL[data.controlStatus]}
          </ToneBadge>
        </div>

        <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-2">
          <Row label="Tarih" value={formatDateTime(data.occurredAt)} />
          <Row
            label="Konum"
            value={
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-400" aria-hidden />
                {data.location.city}, {data.location.countryCode}
              </span>
            }
          />
        </dl>
      </Card>

      {/* ---------------------------------------------- blok uyarısı -- */}
      {blocked && (
        <Banner tone="danger" className="lg:col-span-2">
          <p className="font-semibold">Bu işlem geçici olarak bloklandı</p>
          <p className="mt-0.5">
            Güvenliğin için işlem durduruldu. Bir uzman vakayı inceliyor; sonuç
            bildirimle sana ulaşacak.
          </p>
        </Banner>
      )}

      {/* --------------------------------------------- AI değerlendirmesi -- */}
      <section className="lg:col-span-2">
        <SectionTitle>Yapay Zekâ Değerlendirmesi</SectionTitle>

        {pending ? (
          <Card className="flex items-center gap-4">
            <Loader2 className="size-8 shrink-0 animate-spin text-brand-600" aria-hidden />
            <div>
              <p className="text-[15px] font-semibold text-ink-900">Değerlendiriliyor</p>
              <p className="mt-0.5 text-sm text-ink-500">
                İşlemin arka planda inceleniyor. Sonuç birkaç saniye içinde burada
                görünecek.
              </p>
            </div>
          </Card>
        ) : failed ? (
          <Banner tone="warning">
            <p className="font-semibold">Değerlendirme tamamlanamadı</p>
            <p className="mt-0.5">
              Risk servisi geçici olarak yanıt veremedi. İşlemin kaybolmadı; servis
              döndüğünde yeniden değerlendirilecek.
            </p>
          </Banner>
        ) : (
          <Card>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <RiskGauge score={assessment.riskScore} level={level} size="lg" />

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <ToneBadge toneClass={tone.chip}>
                    Risk: {DISPLAY_RISK_LABEL[level]}
                  </ToneBadge>
                  {assessment.screeningDecision && (
                    <ToneBadge toneClass="bg-brand-100 text-brand-800">
                      Karar: {SCREENING_DECISION_LABEL[assessment.screeningDecision]}
                    </ToneBadge>
                  )}
                  {assessment.fraudType && (
                    <ToneBadge toneClass="bg-ink-100 text-ink-700">
                      {FRAUD_TYPE_LABEL[assessment.fraudType]}
                    </ToneBadge>
                  )}
                </div>

                <ReasonCodes codes={assessment.reasonCodes} />
              </div>
            </div>

            <ModelFooter assessment={assessment} />
          </Card>
        )}
      </section>
    </div>
  );
}

/**
 * Reason code listesi.
 *
 * Bunlar MODEL AÇIKLAMASI DEĞİLDİR — engineered feature ve kural değerlendirme
 * katmanından üretilen operasyonel gerekçelerdir (doküman §12). Kullanıcıya
 * "model şunu düşündü" diye sunulmaz.
 */
function ReasonCodes({ codes }: { codes: ReasonCodeResponse[] }) {
  if (codes.length === 0) return null;

  const IMPACT: Record<string, { label: string; chip: string }> = {
    HIGH: { label: 'Yüksek etki', chip: 'bg-danger-100 text-danger-700' },
    MEDIUM: { label: 'Orta etki', chip: 'bg-warning-100 text-warning-700' },
    LOW: { label: 'Düşük etki', chip: 'bg-ink-100 text-ink-500' },
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink-700">Bu karara etki eden bulgular</p>
      <ul className="space-y-2">
        {codes.map((c) => {
          const impact = IMPACT[c.impact] ?? IMPACT['LOW']!;
          return (
            <li
              key={c.code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-tile bg-canvas px-3 py-2"
            >
              <span className="min-w-0 text-sm text-ink-700">{c.label}</span>
              <span
                className={cn(
                  'shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold',
                  impact.chip,
                )}
              >
                {impact.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ModelFooter({ assessment }: { assessment: AssessmentResponse }) {
  if (!assessment.modelVersion && !assessment.assessedAt) return null;

  return (
    <p className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3 text-xs text-ink-400">
      <Cpu className="size-3.5" aria-hidden />
      {assessment.modelVersion && <span>Model {assessment.modelVersion}</span>}
      {assessment.assessedAt && <span>· {formatDateTime(assessment.assessedAt)}</span>}
    </p>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Yükleniyor">
      <div className="surface-card space-y-3 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="surface-card flex gap-4 p-4">
        <Skeleton className="size-32 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-24 rounded-pill" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
