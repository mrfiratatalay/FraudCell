namespace FraudCell.Transaction.Service.Domain;

/// <summary>
/// <c>txn.idempotency_records</c>. Ayni key+farkli payload
/// 409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD dondurur.
/// </summary>
public sealed class IdempotencyRecord
{
    public required string Id { get; set; }

    /// <summary>Ornegin "transaction.create". Ayni key farkli operasyonlarda tekrar kullanilabilir.</summary>
    public required string Scope { get; set; }

    public required string ActorId { get; set; }

    public required string IdempotencyKey { get; set; }

    public required string RequestHash { get; set; }

    public IdempotencyStatus Status { get; set; } = IdempotencyStatus.PROCESSING;

    public int? ResponseStatusCode { get; set; }

    public string? ResponseBody { get; set; }

    public string? ResourceId { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public required DateTimeOffset ExpiresAt { get; set; }

    public long Version { get; set; }
}

/// <summary><c>txn.transaction_number_counters</c>. Yillik sayac; <c>TRX-{year}-{000000}</c> uretir.</summary>
public sealed class TransactionNumberCounter
{
    public required int Year { get; set; }

    public long LastValue { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
