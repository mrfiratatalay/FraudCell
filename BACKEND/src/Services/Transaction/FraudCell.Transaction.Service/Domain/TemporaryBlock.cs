namespace FraudCell.Transaction.Service.Domain;

/// <summary>
/// <c>txn.temporary_blocks</c>. Ayni transaction+reason icin
/// tek aktif blok olur (unique partial index, released_at IS NULL).
/// </summary>
public sealed class TemporaryBlock
{
    public required string Id { get; set; }

    public required string TransactionId { get; set; }

    public required TemporaryBlockReason Reason { get; set; }

    public string? AppliedBy { get; set; }

    public string? SourceEventId { get; set; }

    public required DateTimeOffset AppliedAt { get; set; }

    public DateTimeOffset? ReleasedAt { get; set; }

    public string? ReleaseReason { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }
}
