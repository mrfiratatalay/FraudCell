namespace FraudCell.Transaction.Service.Domain;

/// <summary><c>txn.customer_verifications</c>. Bir case'te ayni anda en fazla bir PENDING kayit olur.</summary>
public sealed class CustomerVerification
{
    public required string Id { get; set; }

    public required string CaseId { get; set; }

    public required string CustomerId { get; set; }

    public required string RequestedBy { get; set; }

    public string? Message { get; set; }

    public VerificationStatus Status { get; set; } = VerificationStatus.PENDING;

    public VerificationResponse? Response { get; set; }

    public required DateTimeOffset RequestedAt { get; set; }

    public required DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? RespondedAt { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public long Version { get; set; }
}
