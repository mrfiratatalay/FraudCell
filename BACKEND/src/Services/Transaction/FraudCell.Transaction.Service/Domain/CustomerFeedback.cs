namespace FraudCell.Transaction.Service.Domain;

/// <summary><c>txn.customer_feedback</c>. Case basina tek kayit; yalnizca KAPANDI vakada verilebilir.</summary>
public sealed class CustomerFeedback
{
    public required string Id { get; set; }

    public required string CaseId { get; set; }

    public required string TransactionId { get; set; }

    public required string CustomerId { get; set; }

    public required int Rating { get; set; }

    public string? Comment { get; set; }

    public required DateTimeOffset SubmittedAt { get; set; }

    public string? SourceEventId { get; set; }
}
