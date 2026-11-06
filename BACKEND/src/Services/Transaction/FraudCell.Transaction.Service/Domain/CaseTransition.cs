namespace FraudCell.Transaction.Service.Domain;

/// <summary><c>txn.case_transitions</c>. Append-only gecmis; runtime user'a UPDATE/DELETE verilmez.</summary>
public sealed class CaseTransition
{
    public required string Id { get; set; }

    public required string CaseId { get; set; }

    public required CaseStatus PreviousStatus { get; set; }

    public required CaseStatus NewStatus { get; set; }

    public string? ActorId { get; set; }

    public string? ActorRole { get; set; }

    public required TransitionSource TransitionSource { get; set; }

    public string? Reason { get; set; }

    public required string CorrelationId { get; set; }

    public string? CausationId { get; set; }

    public string? SourceEventId { get; set; }

    public required long CaseVersionBefore { get; set; }

    public required long CaseVersionAfter { get; set; }

    public required DateTimeOffset OccurredAt { get; set; }
}
