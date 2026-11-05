namespace FraudCell.BuildingBlocks.Messaging.Inbox;

/// <summary>
/// Idempotent consumer kaydi.
///
/// At-least-once teslimde ayni event birden fazla kez gelebilir. Business islem
/// calistirilmadan once (EventId, ConsumerName) ciftinin varligi kontrol edilir;
/// varsa mesaj islenmeden ACK edilir.
///
/// Unique constraint bilinclidir: yaris durumunda ikinci INSERT'in patlamasi,
/// puanin iki kez yazilmasindan iyidir.
/// </summary>
public sealed class InboxMessage
{
    public required string EventId { get; set; }

    /// <summary>
    /// Ayni event'i birden fazla consumer tuketebilir (ornegin case.decision.made'i
    /// hem Gamification hem Audit dinler). Bu yuzden anahtar EventId TEK BASINA degildir.
    /// </summary>
    public required string ConsumerName { get; set; }

    public required string EventType { get; set; }

    public int EventVersion { get; set; } = 1;

    /// <summary>
    /// Ayni EventId farkli payload ile tekrar gelirse (producer hatasi/saldiri
    /// senaryosu) tespit icin.
    /// </summary>
    public string? PayloadHash { get; set; }

    public InboxStatus Status { get; set; } = InboxStatus.Processed;

    public int AttemptCount { get; set; } = 1;

    public string? LastError { get; set; }

    public required DateTimeOffset ProcessedAt { get; set; }

    public required string CorrelationId { get; set; }
}

/// <summary>§59.1.</summary>
public enum InboxStatus
{
    Processing,
    Processed,
    Failed,
}
