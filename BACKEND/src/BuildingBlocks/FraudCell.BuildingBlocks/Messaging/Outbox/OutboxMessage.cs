namespace FraudCell.BuildingBlocks.Messaging.Outbox;

/// <summary>
/// Transactional outbox kaydi.
///
/// Kritik kural: bu satir, kendisini doguran business degisikligiyle AYNI
/// database transaction'inda yazilir. Boylece "veri yazildi ama event kayboldu"
/// (dual-write) durumu olusamaz.
/// </summary>
public sealed class OutboxMessage
{
    /// <summary>Event kimligi (ULID). Broker'a giden zarftaki <c>eventId</c> ile aynidir.</summary>
    public required string Id { get; set; }

    public required string EventType { get; set; }

    public required int EventVersion { get; set; }

    /// <summary>Topic exchange routing key. Genellikle EventType ile aynidir.</summary>
    public required string RoutingKey { get; set; }

    public required string SubjectId { get; set; }

    public required string CorrelationId { get; set; }

    public string? CausationId { get; set; }

    public required string Producer { get; set; }

    /// <summary>Event'in domain seviyesinde gerceklestigi an (broker'a verildigi an degil).</summary>
    public required DateTimeOffset OccurredAt { get; set; }

    /// <summary>Serialize edilmis payload. PostgreSQL tarafinda jsonb.</summary>
    public required string Payload { get; set; }

    /// <summary>Publisher confirm alindiktan SONRA doldurulur. Null ise event hala bekliyordur.</summary>
    public DateTimeOffset? PublishedAt { get; set; }

    public int AttemptCount { get; set; }

    /// <summary>Basarisiz denemeden sonraki geri cekilme zamani.</summary>
    public DateTimeOffset? NextAttemptAt { get; set; }

    /// <summary>
    /// Birden fazla publisher instance'i ayni kaydi almasin diye kullanilan kira suresi.
    /// <see cref="NextAttemptAt"/>'ten ayridir: o retry backoff'unu,
    /// bu ise "su an baska bir instance isliyor" durumunu ifade eder.
    /// </summary>
    public DateTimeOffset? LockedUntil { get; set; }

    /// <summary>Kaydi kiralayan instance kimligi; teshis icin tutulur.</summary>
    public string? LockOwner { get; set; }

    /// <summary>Event zarfindaki opsiyonel ek header'lar. Baseline'da genelde bos.</summary>
    public string? Headers { get; set; }

    /// <summary>Son yayin denemesinin hatasi. Operasyon ekraninda teshis icin tutulur.</summary>
    public string? LastError { get; set; }
}
