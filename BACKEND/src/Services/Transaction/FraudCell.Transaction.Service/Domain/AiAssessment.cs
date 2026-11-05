namespace FraudCell.Transaction.Service.Domain;

public sealed record ReasonCode(string Code, string Label, string Impact);

public sealed record AnalystCandidate(string AnalystId, int Rank, decimal Score, decimal ExpertiseScore, decimal CapacityScore, decimal PerformanceScore);

/// <summary>
/// <c>txn.ai_assessments</c>. AI Service'ten gelen prediction
/// snapshot'i; Transaction Service AI Database'e baglanmaz, yalnizca bu
/// snapshot'i tutar. Orijinal
/// alanlar IMMUTABLE'dir; sonradan degistirilmez.
/// </summary>
public sealed class AiAssessment
{
    public required string Id { get; set; }

    public required string ExternalAssessmentId { get; set; }

    public required string TransactionId { get; set; }

    public required string SourceEventId { get; set; }

    public required decimal RiskScore { get; set; }

    public required RiskLevel RiskLevel { get; set; }

    public required ScreeningDecision Decision { get; set; }

    public required FraudType FraudType { get; set; }

    public required string ModelVersion { get; set; }

    /// <summary>JSONB olarak serialize edilmis <see cref="ReasonCode"/> listesi.</summary>
    public required string ReasonCodesJson { get; set; }

    /// <summary>JSONB olarak serialize edilmis <see cref="AnalystCandidate"/> listesi.</summary>
    public required string AnalystCandidatesJson { get; set; }

    public required DateTimeOffset AssessedAt { get; set; }

    public required DateTimeOffset ReceivedAt { get; set; }

    public bool IsLate { get; set; }

    /// <summary>Bu transaction icin ilk/gecerli sayilan degerlendirme mi.</summary>
    public bool IsPrimary { get; set; }

    public required string PayloadHash { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }
}
