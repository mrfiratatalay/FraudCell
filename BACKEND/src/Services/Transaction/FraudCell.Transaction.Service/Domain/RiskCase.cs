using FraudCell.BuildingBlocks.Api;

namespace FraudCell.Transaction.Service.Domain;

/// <summary>
/// <c>txn.risk_cases</c> (dokuman §23) — sistemin risk vakasi state machine'i
/// (dokuman `05-DOMAIN-AND-STATE-MACHINE.md` §16-30). Durum degisikligi
/// yalnizca bu sinifin niyet belirten metotlariyla yapilir; generic bir
/// <c>Status</c> setter'i YOKTUR (dokuman §2.1).
/// </summary>
public sealed class RiskCase
{
    /// <summary>Dokuman §27: a decided case closes 48 hours later (configurable via <c>CaseClosure:Delay</c>).</summary>
    public static readonly TimeSpan DefaultClosureDelay = TimeSpan.FromHours(48);

    public required string Id { get; set; }

    public required string TransactionId { get; set; }

    public required string CustomerId { get; set; }

    public string? PrimaryAssessmentId { get; set; }

    public CaseStatus Status { get; private set; } = CaseStatus.YENI;

    public AssignmentStatus AssignmentStatus { get; private set; } = AssignmentStatus.UNASSIGNED;

    public string? AssignedAnalystId { get; private set; }

    public decimal? EffectiveRiskScore { get; set; }

    public RiskLevel? EffectiveRiskLevel { get; set; }

    public FraudType? EffectiveFraudType { get; set; }

    public SlaPriority SlaPriority { get; private set; }

    public required DateTimeOffset SlaStartedAt { get; set; }

    public DateTimeOffset SlaDeadlineAt { get; private set; }

    public DateTimeOffset? SlaBreachedAt { get; private set; }

    public DateTimeOffset? SlaStoppedAt { get; private set; }

    public DateTimeOffset? ReviewStartedAt { get; private set; }

    public FinalDecision? FinalDecision { get; private set; }

    public string? DecisionNote { get; private set; }

    public string? DecidedBy { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public DateTimeOffset? ClosureDueAt { get; private set; }

    public DateTimeOffset? ClosedAt { get; private set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }

    private static readonly Dictionary<SlaPriority, TimeSpan> SlaDurations = new()
    {
        [SlaPriority.KRITIK] = TimeSpan.FromMinutes(15),
        [SlaPriority.YUKSEK] = TimeSpan.FromHours(1),
        [SlaPriority.ORTA] = TimeSpan.FromHours(4),
        [SlaPriority.DUSUK] = TimeSpan.FromHours(24),
    };

    public static TimeSpan DurationFor(SlaPriority priority) => SlaDurations[priority];

    /// <summary>Dokuman §36: SLA case olusturuldugu anda baslar, atamayi/review'i beklemez.</summary>
    public void StartSla(SlaPriority priority, DateTimeOffset caseCreatedAt)
    {
        SlaPriority = priority;
        SlaStartedAt = caseCreatedAt;
        SlaDeadlineAt = caseCreatedAt + DurationFor(priority);
    }

    public bool IsActiveWorkload => Status is CaseStatus.ATANDI or CaseStatus.INCELENIYOR or CaseStatus.MUSTERI_DOGRULAMA;

    public bool IsFinal => Status is CaseStatus.ONAYLANDI or CaseStatus.BLOKLANDI or CaseStatus.KAPANDI;

    /// <summary>Dokuman §20 YENI -> ATANDI.</summary>
    public void Assign(string analystId, DateTimeOffset now)
    {
        if (Status != CaseStatus.YENI)
        {
            throw AppException.DomainRule(ErrorCodes.InvalidCaseTransition, $"{Status} durumundan ATANDI durumuna gecilemez.",
                Details(Status, CaseStatus.ATANDI));
        }

        AssignedAnalystId = analystId;
        AssignmentStatus = AssignmentStatus.ASSIGNED;
        Status = CaseStatus.ATANDI;
        Touch(now);
    }

    /// <summary>Dokuman §32.2/§32.3 QUEUED veya MANUAL_QUEUE'ya alma (kapasite yok / AI yok).</summary>
    public void EnqueueForAssignment(bool manual, DateTimeOffset now)
    {
        if (Status != CaseStatus.YENI)
        {
            throw AppException.DomainRule(ErrorCodes.InvalidCaseTransition, "Yalnızca YENI durumundaki vaka kuyruğa alınabilir.");
        }

        AssignmentStatus = manual ? AssignmentStatus.MANUAL_QUEUE : AssignmentStatus.QUEUED;
        Touch(now);
    }

    /// <summary>Dokuman §34 supervisor manuel atama/reassignment.</summary>
    public void Reassign(string newAnalystId, DateTimeOffset now)
    {
        if (IsFinal)
        {
            throw AppException.DomainRule(ErrorCodes.CaseAlreadyDecided, "Final karar verilmiş vakada atama değiştirilemez.");
        }

        AssignedAnalystId = newAnalystId;
        AssignmentStatus = Status == CaseStatus.YENI ? AssignmentStatus.ASSIGNED : AssignmentStatus.IN_PROGRESS;

        if (Status == CaseStatus.YENI)
        {
            Status = CaseStatus.ATANDI;
        }

        Touch(now);
    }

    /// <summary>Dokuman §21 ATANDI -> INCELENIYOR.</summary>
    public void StartReview(string actorAnalystId, bool isSupervisorOverride, DateTimeOffset now)
    {
        if (Status == CaseStatus.INCELENIYOR)
        {
            return; // Idempotent: ayni analist tekrar cagirirsa (dokuman §21).
        }

        if (Status != CaseStatus.ATANDI)
        {
            throw AppException.DomainRule(ErrorCodes.InvalidCaseTransition, $"{Status} durumundan INCELENIYOR durumuna gecilemez.",
                Details(Status, CaseStatus.INCELENIYOR));
        }

        if (!isSupervisorOverride && AssignedAnalystId != actorAnalystId)
        {
            throw AppException.Forbidden("Bu vaka size atanmamis.");
        }

        AssignmentStatus = AssignmentStatus.IN_PROGRESS;
        Status = CaseStatus.INCELENIYOR;
        ReviewStartedAt = now;
        Touch(now);
    }

    /// <summary>Dokuman §22 INCELENIYOR -> MUSTERI_DOGRULAMA.</summary>
    public void RequestCustomerVerification(DateTimeOffset now)
    {
        if (Status != CaseStatus.INCELENIYOR)
        {
            throw AppException.DomainRule(ErrorCodes.InvalidCaseTransition, $"{Status} durumundan MUSTERI_DOGRULAMA durumuna gecilemez.",
                Details(Status, CaseStatus.MUSTERI_DOGRULAMA));
        }

        Status = CaseStatus.MUSTERI_DOGRULAMA;
        Touch(now);
    }

    /// <summary>Dokuman §23 MUSTERI_DOGRULAMA -> INCELENIYOR (cevap veya timeout).</summary>
    public void ResumeReviewAfterVerification(DateTimeOffset now)
    {
        if (Status != CaseStatus.MUSTERI_DOGRULAMA)
        {
            throw AppException.DomainRule(ErrorCodes.InvalidCaseTransition, "Aktif bir müşteri doğrulaması bulunmuyor.");
        }

        Status = CaseStatus.INCELENIYOR;
        Touch(now);
    }

    /// <summary>Dokuman §25: "Ben yapmadim" cevabi risk seviyesini KRITIK'e yukseltir ve SLA'yi yeniden hesaplar.</summary>
    public void EscalateToCriticalFromCustomerDenial(DateTimeOffset caseCreatedAt, DateTimeOffset now)
    {
        EffectiveRiskScore = EffectiveRiskScore is { } current ? Math.Max(current, 0.91m) : 0.91m;
        EffectiveRiskLevel = RiskLevel.KRITIK;

        SlaPriority = SlaPriority.KRITIK;
        SlaDeadlineAt = caseCreatedAt + DurationFor(SlaPriority.KRITIK);

        Touch(now);
    }

    /// <summary>Dokuman §26 INCELENIYOR -> ONAYLANDI.</summary>
    public void Approve(string decidedBy, string? note, DateTimeOffset now, TimeSpan? closureDelay = null)
    {
        RequireInReview();

        FinalDecision = Domain.FinalDecision.APPROVE;
        DecisionNote = note;
        DecidedBy = decidedBy;
        DecidedAt = now;
        SlaStoppedAt = now;
        Status = CaseStatus.ONAYLANDI;
        AssignmentStatus = AssignmentStatus.COMPLETED;
        ClosureDueAt = now + (closureDelay ?? DefaultClosureDelay);
        Touch(now);
    }

    /// <summary>Dokuman §27 INCELENIYOR -> BLOKLANDI. Karar notu zorunludur.</summary>
    public void Block(string decidedBy, string note, DateTimeOffset now, TimeSpan? closureDelay = null)
    {
        RequireInReview();

        if (string.IsNullOrWhiteSpace(note))
        {
            throw AppException.DomainRule(ErrorCodes.DecisionNoteRequired, "Blok kararinda karar notu zorunludur.");
        }

        FinalDecision = Domain.FinalDecision.BLOCK;
        DecisionNote = note;
        DecidedBy = decidedBy;
        DecidedAt = now;
        SlaStoppedAt = now;
        Status = CaseStatus.BLOKLANDI;
        AssignmentStatus = AssignmentStatus.COMPLETED;
        ClosureDueAt = now + (closureDelay ?? DefaultClosureDelay);
        Touch(now);
    }

    /// <summary>
    /// Closed by the system 48 hours after the decision. Case §4.2 lists only
    /// ONAYLANDI -> KAPANDI; BLOKLANDI closes too because the customer may rate
    /// only a KAPANDI case (§4.6) and also rates blocked transactions (§11.1).
    /// </summary>
    public void Close(DateTimeOffset now)
    {
        if (Status is not (CaseStatus.ONAYLANDI or CaseStatus.BLOKLANDI))
        {
            throw AppException.DomainRule(ErrorCodes.InvalidCaseTransition, "Yalnızca ONAYLANDI/BLOKLANDI vaka kapatılabilir.");
        }

        Status = CaseStatus.KAPANDI;
        ClosedAt = now;
        Touch(now);
    }

    /// <summary>
    /// Dokuman §43.2-43.4: gec gelen AI sonucu final karar oncesinde evidence
    /// olarak efektif risk bilgisini gunceller; state/assignment DEGISTIRMEZ.
    /// </summary>
    public void ApplyLateEvidence(decimal riskScore, RiskLevel riskLevel, FraudType fraudType, DateTimeOffset now)
    {
        if (IsFinal)
        {
            return;
        }

        EffectiveRiskScore = riskScore;
        EffectiveRiskLevel = riskLevel;
        EffectiveFraudType = fraudType;
        Touch(now);
    }

    public void MarkSlaBreached(DateTimeOffset now)
    {
        SlaBreachedAt ??= now;
        Touch(now);
    }

    /// <summary>Dokuman §12/§40: supervisor efektif risk seviyesini degistirir, SLA yeniden hesaplanir.</summary>
    public void OverrideRiskLevel(RiskLevel newLevel, DateTimeOffset now)
    {
        if (IsFinal)
        {
            throw AppException.DomainRule(ErrorCodes.CaseAlreadyDecided, "Final karar sonrası risk seviyesi değiştirilemez.");
        }

        EffectiveRiskLevel = newLevel;
        SlaPriority = newLevel switch
        {
            RiskLevel.KRITIK => SlaPriority.KRITIK,
            RiskLevel.YUKSEK => SlaPriority.YUKSEK,
            RiskLevel.ORTA => SlaPriority.ORTA,
            _ => SlaPriority.DUSUK,
        };

        SlaDeadlineAt = CreatedAt + DurationFor(SlaPriority);
        Touch(now);
    }

    public void OverrideFraudType(FraudType newType, DateTimeOffset now)
    {
        if (IsFinal)
        {
            throw AppException.DomainRule(ErrorCodes.CaseAlreadyDecided, "Final karar sonrası fraud türü değiştirilemez.");
        }

        EffectiveFraudType = newType;
        Touch(now);
    }

    private void RequireInReview()
    {
        if (FinalDecision is not null)
        {
            throw AppException.DomainRule(ErrorCodes.CaseAlreadyDecided, "Bu vaka için zaten nihai karar verilmiş.");
        }

        if (Status != CaseStatus.INCELENIYOR)
        {
            throw AppException.DomainRule(ErrorCodes.InvalidCaseTransition, $"{Status} durumunda karar verilemez.",
                Details(Status, CaseStatus.ONAYLANDI));
        }
    }

    private void Touch(DateTimeOffset now)
    {
        UpdatedAt = now;
        Version++;
    }

    private static Dictionary<string, object?> Details(CaseStatus current, CaseStatus requested)
        => new() { ["currentState"] = current.ToString(), ["requestedState"] = requested.ToString() };
}
