namespace FraudCell.Transaction.Service.Domain;

/// <summary>
/// <c>txn.transactions</c>. Musterinin
/// gerceklestirdigi islem; risk case olusmasa dahi kalicidir (dokuman.
/// </summary>
public sealed class FraudTransaction
{
    public required string Id { get; set; }

    public required string TransactionNo { get; set; }

    public required string CustomerId { get; set; }

    public required decimal Amount { get; set; }

    public string Currency { get; set; } = "TRY";

    public required TransactionType TransactionType { get; set; }

    public required string RecipientReference { get; set; }

    public required string DeviceFingerprintHash { get; set; }

    public required string City { get; set; }

    public required string CountryCode { get; set; }

    public required DateTimeOffset OccurredAt { get; set; }

    public AssessmentStatus AssessmentStatus { get; set; } = AssessmentStatus.PENDING;

    public required DateTimeOffset AssessmentDeadlineAt { get; set; }

    public decimal? EffectiveRiskScore { get; set; }

    public RiskLevel? EffectiveRiskLevel { get; set; }

    public FraudType? EffectiveFraudType { get; set; }

    /// <summary>Baslangicta guvenli varsayilan <c>INCELEME</c>'dir; AI kapaliyken de degismez.</summary>
    public ScreeningDecision ScreeningDecision { get; set; } = ScreeningDecision.INCELEME;

    public ControlStatus ControlStatus { get; set; } = ControlStatus.ALLOWED;

    /// <summary>AI timeout/failure fallback nedeni.</summary>
    public string? ManualReviewReason { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public long Version { get; set; }

    /// <summary>
    /// AI sonucu ilk kez uygulanirken cagrilir. Gec/duplicate
    /// sonuclarda cagrilmaz; caller <see cref="AssessmentStatus"/>'un hala
    /// <c>PENDING</c> oldugunu once kontrol etmelidir.
    /// </summary>
    public void ApplyAssessment(decimal riskScore, RiskLevel riskLevel, ScreeningDecision decision, FraudType fraudType, DateTimeOffset now)
    {
        AssessmentStatus = AssessmentStatus.COMPLETED;
        EffectiveRiskScore = riskScore;
        EffectiveRiskLevel = riskLevel;
        EffectiveFraudType = fraudType;
        ScreeningDecision = decision;
        ManualReviewReason = null;

        ControlStatus = decision switch
        {
            ScreeningDecision.ONAY => ControlStatus.APPROVED,
            ScreeningDecision.BLOK => ControlStatus.TEMPORARILY_BLOCKED,
            _ => ControlStatus.ALLOWED,
        };

        UpdatedAt = now;
        Version++;
    }

    /// <summary>Watchdog deadline gecti, AI sonucu gelmedi.</summary>
    public void MarkAssessmentTimedOut(DateTimeOffset now)
    {
        AssessmentStatus = AssessmentStatus.TIMED_OUT;
        ScreeningDecision = ScreeningDecision.INCELEME;
        ManualReviewReason = "AI_ASSESSMENT_TIMED_OUT";
        UpdatedAt = now;
        Version++;
    }

    public void MarkAssessmentFailed(DateTimeOffset now)
    {
        AssessmentStatus = AssessmentStatus.FAILED;
        ScreeningDecision = ScreeningDecision.INCELEME;
        ManualReviewReason = "AI_ASSESSMENT_FAILED";
        UpdatedAt = now;
        Version++;
    }

    /// <summary>
    /// Gec gelen AI sonucu: control status uzerine yazmaz eger
    /// zaten nihai APPROVED/BLOCKED ise; yalnizca efektif risk bilgisini
    /// evidence olarak gunceller.
    /// </summary>
    public void ApplyLateAssessmentEvidence(decimal riskScore, RiskLevel riskLevel, FraudType fraudType, DateTimeOffset now)
    {
        if (ControlStatus is ControlStatus.APPROVED or ControlStatus.BLOCKED)
        {
            return;
        }

        EffectiveRiskScore = riskScore;
        EffectiveRiskLevel = riskLevel;
        EffectiveFraudType = fraudType;
        UpdatedAt = now;
        Version++;
    }

    public void MarkTemporarilyBlocked(DateTimeOffset now)
    {
        if (ControlStatus is ControlStatus.APPROVED or ControlStatus.BLOCKED)
        {
            return;
        }

        ControlStatus = ControlStatus.TEMPORARILY_BLOCKED;
        UpdatedAt = now;
        Version++;
    }

    public void ApproveFinal(DateTimeOffset now)
    {
        ControlStatus = ControlStatus.APPROVED;
        UpdatedAt = now;
        Version++;
    }

    public void BlockFinal(DateTimeOffset now)
    {
        ControlStatus = ControlStatus.BLOCKED;
        UpdatedAt = now;
        Version++;
    }

    public string DisplayRiskLevel => EffectiveRiskLevel?.ToString() ?? "BELIRSIZ";
}
