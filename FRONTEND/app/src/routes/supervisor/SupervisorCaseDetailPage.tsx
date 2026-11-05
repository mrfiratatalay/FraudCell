import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScanSearch, ShieldAlert, UserRoundCog } from 'lucide-react';
import { CaseFacts, CaseHeader, CaseHistoryPanel, RiskAssessmentPanel } from '@/features/cases/CaseParts';
import {
  assignCase,
  getCase,
  overrideCaseFraudType,
  overrideCaseRisk,
  reassignCase,
} from '@/features/cases/api';
import { listStaff } from '@/features/staff/api';
import { useHasRole } from '@/features/authentication/useSession';
import type { FraudType, RiskLevel } from '@/shared/api/enums';
import {
  ASSIGNMENT_STATUS_LABEL,
  FRAUD_TYPES,
  FRAUD_TYPE_LABEL,
  RISK_LEVELS,
  RISK_LEVEL_LABEL,
} from '@/shared/api/enums';
import { queryKeys } from '@/shared/api/query-keys';
import { fullName } from '@/shared/lib/format';
import { Avatar, Button, ErrorState, Sheet, SkeletonList, TextAreaField, useToast } from '@/shared/ui';

type ActionPanel = 'assignment' | 'risk' | 'fraud' | null;

export function SupervisorCaseDetailPage({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const canManage = useHasRole('SUPERVISOR');
  const [panel, setPanel] = useState<ActionPanel>(null);
  const [analystId, setAnalystId] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel | ''>('');
  const [fraudType, setFraudType] = useState<FraudType | ''>('');
  const [reason, setReason] = useState('');

  const caseQuery = useQuery({
    queryKey: queryKeys.cases.detail(caseId),
    queryFn: () => getCase(caseId),
  });
  const staff = useQuery({
    queryKey: queryKeys.staff.list,
    queryFn: () => listStaff(100),
  });
  const riskCase = caseQuery.data?.data;
  const version = caseQuery.data?.etag ?? riskCase?.version;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.all }),
    ]);
  };
  const completed = async (message: string) => {
    setPanel(null);
    setReason('');
    await refresh();
    toast.success(message);
  };

  const assignment = useMutation({
    mutationFn: async () => {
      if (!riskCase || version === undefined || !analystId || !reason.trim()) return;
      if (riskCase.assignedAnalystId) {
        await reassignCase(caseId, version, { newAnalystId: analystId, reason: reason.trim() });
      } else {
        await assignCase(caseId, version, { analystId, reason: reason.trim() });
      }
    },
    onSuccess: () => void completed(riskCase?.assignedAnalystId ? 'Vaka yeniden atandı' : 'Vaka atandı'),
    onError: (error) => toast.fromError(error),
  });
  const riskOverride = useMutation({
    mutationFn: async () => {
      if (version === undefined || !riskLevel || !reason.trim()) return;
      await overrideCaseRisk(caseId, version, { riskLevel, reason: reason.trim() });
    },
    onSuccess: () => void completed('Risk seviyesi güncellendi'),
    onError: (error) => toast.fromError(error),
  });
  const fraudOverride = useMutation({
    mutationFn: async () => {
      if (version === undefined || !fraudType || !reason.trim()) return;
      await overrideCaseFraudType(caseId, version, { fraudType, reason: reason.trim() });
    },
    onSuccess: () => void completed('Risk tipi güncellendi'),
    onError: (error) => toast.fromError(error),
  });

  const analysts = (staff.data?.items ?? []).filter(
    (person) => person.role === 'ANALYST' && person.isActive && person.assignmentEnabled,
  );
  const assignedAnalyst = (staff.data?.items ?? []).find(
    (person) => person.id === riskCase?.assignedAnalystId,
  );

  const openPanel = (next: Exclude<ActionPanel, null>) => {
    setReason('');
    setAnalystId('');
    setRiskLevel('');
    setFraudType('');
    setPanel(next);
  };

  if (caseQuery.isPending) return <SkeletonList rows={4} />;
  if (caseQuery.isError || !riskCase)
    return <ErrorState error={caseQuery.error} onRetry={() => void caseQuery.refetch()} />;

  const activeMutation = assignment.isPending || riskOverride.isPending || fraudOverride.isPending;
  const analystName = assignedAnalyst
    ? fullName(assignedAnalyst.firstName, assignedAnalyst.lastName)
    : riskCase.assignedAnalystId
      ? 'Analist'
      : null;

  return (
    <div>
      <CaseHeader item={riskCase} />
      <CaseFacts item={riskCase} />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <RiskAssessmentPanel item={riskCase} />

        <aside className="surface-panel overflow-hidden lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-labelledby="assignment-title">
          <div className="border-b border-line px-5 py-4">
            <h2 id="assignment-title" className="text-h3 text-ink-900">
              Atama
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-500">{ASSIGNMENT_STATUS_LABEL[riskCase.assignmentStatus]}</p>
          </div>
          <div className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              {analystName ? (
                <Avatar name={analystName} size="md" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full border border-dashed border-ink-300 text-ink-400">
                  <UserRoundCog className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{analystName ?? 'Henüz atanmadı'}</p>
                <p className="truncate text-xs text-ink-500">{assignedAnalyst?.email ?? 'Kuyrukta bekliyor'}</p>
              </div>
            </div>
            {canManage ? (
              <Button fullWidth variant={riskCase.assignedAnalystId ? 'secondary' : 'primary'} leadingIcon={<UserRoundCog className="size-4" />} onClick={() => openPanel('assignment')}>
                {riskCase.assignedAnalystId ? 'Yeniden ata' : 'Analist ata'}
              </Button>
            ) : null}
          </div>

          {canManage ? (
            <div className="space-y-2 border-t border-line p-5">
              <p className="mb-3 text-[13px] text-ink-500">AI sonucunu düzelt — gerekçe denetim kaydına yazılır.</p>
              <Button fullWidth variant="secondary" leadingIcon={<ShieldAlert className="size-4" />} onClick={() => openPanel('risk')}>
                Risk seviyesini değiştir
              </Button>
              <Button fullWidth variant="secondary" leadingIcon={<ScanSearch className="size-4" />} onClick={() => openPanel('fraud')}>
                Risk tipini değiştir
              </Button>
            </div>
          ) : null}
        </aside>

        <CaseHistoryPanel caseId={caseId} createdAt={riskCase.createdAt} />
      </div>

      <Sheet
        open={panel !== null}
        onOpenChange={(open) => { if (!open && !activeMutation) setPanel(null); }}
        title={panel === 'assignment' ? 'Vaka ataması' : panel === 'risk' ? 'Risk seviyesi' : 'Risk tipi'}
        footer={
          <Button
            loading={activeMutation}
            disabled={!reason.trim() || (panel === 'assignment' ? !analystId : panel === 'risk' ? !riskLevel : !fraudType)}
            onClick={() => {
              if (panel === 'assignment') assignment.mutate();
              if (panel === 'risk') riskOverride.mutate();
              if (panel === 'fraud') fraudOverride.mutate();
            }}
          >
            Kaydet
          </Button>
        }
      >
        {panel === 'assignment' ? (
          <label className="block text-[13px] font-medium text-ink-700">Analist
            <select aria-label="Analist" value={analystId} onChange={(event) => setAnalystId(event.target.value)} className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-normal text-ink-900 shadow-card focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none">
              <option value="">Analist seç</option>
              {analysts.filter((person) => person.id !== riskCase.assignedAnalystId).map((person) => <option key={person.id} value={person.id}>{fullName(person.firstName, person.lastName)} · {person.email}</option>)}
            </select>
          </label>
        ) : null}
        {panel === 'risk' ? (
          <label className="block text-[13px] font-medium text-ink-700">Yeni risk seviyesi
            <select aria-label="Yeni risk seviyesi" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as RiskLevel)} className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-normal text-ink-900 shadow-card focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none">
              <option value="">Seviye seç</option>
              {RISK_LEVELS.filter((value) => value !== riskCase.effectiveRisk.riskLevel).map((value) => <option key={value} value={value}>{RISK_LEVEL_LABEL[value]}</option>)}
            </select>
          </label>
        ) : null}
        {panel === 'fraud' ? (
          <label className="block text-[13px] font-medium text-ink-700">Yeni risk tipi
            <select aria-label="Yeni risk tipi" value={fraudType} onChange={(event) => setFraudType(event.target.value as FraudType)} className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-sm font-normal text-ink-900 shadow-card focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-none">
              <option value="">Tip seç</option>
              {FRAUD_TYPES.filter((value) => value !== riskCase.effectiveRisk.fraudType).map((value) => <option key={value} value={value}>{FRAUD_TYPE_LABEL[value]}</option>)}
            </select>
          </label>
        ) : null}
        <TextAreaField className="mt-4" label="Gerekçe" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
      </Sheet>
    </div>
  );
}
