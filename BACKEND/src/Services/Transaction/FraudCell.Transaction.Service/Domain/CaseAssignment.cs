namespace FraudCell.Transaction.Service.Domain;

/// <summary><c>txn.case_assignments</c>. Gecmis silinmez; reassignment eskisini CANCELLED yapar.</summary>
public sealed class CaseAssignment
{
    public required string Id { get; set; }

    public required string CaseId { get; set; }

    public required string AnalystId { get; set; }

    public CaseAssignmentStatus Status { get; set; } = CaseAssignmentStatus.ASSIGNED;

    public required AssignmentSource AssignmentSource { get; set; }

    public string? AssignedBy { get; set; }

    public string? AssignmentReason { get; set; }

    public required DateTimeOffset AssignedAt { get; set; }

    public DateTimeOffset? StartedAt { get; set; }

    public DateTimeOffset? EndedAt { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public long Version { get; set; }
}
