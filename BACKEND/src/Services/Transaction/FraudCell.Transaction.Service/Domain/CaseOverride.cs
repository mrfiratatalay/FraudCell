namespace FraudCell.Transaction.Service.Domain;

/// <summary><c>txn.case_overrides</c>. Fraud turu/risk seviyesi override gecmisi; append-only.</summary>
public sealed class CaseOverride
{
    public required string Id { get; set; }

    public required string CaseId { get; set; }

    public required OverrideType OverrideType { get; set; }

    public required string PreviousValue { get; set; }

    public required string NewValue { get; set; }

    public required string Reason { get; set; }

    public required string ActorId { get; set; }

    public required string ActorRole { get; set; }

    public string? SourceEventId { get; set; }

    public required DateTimeOffset OccurredAt { get; set; }
}
