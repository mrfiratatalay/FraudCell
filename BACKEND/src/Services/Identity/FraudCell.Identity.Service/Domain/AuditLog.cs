namespace FraudCell.Identity.Service.Domain;

public enum AuditResult
{
    Success,
    Failure,
    Denied,
}

/// <summary>
/// <c>identity.audit_logs</c>. Append-only; API'den guncellenemez
/// veya silinemez. <see cref="SourceEventId"/>'nin unique olmasi ayni event'in
/// ikinci kez kaydedilmesini engeller.
/// </summary>
public sealed class AuditLog
{
    public required string Id { get; set; }

    /// <summary>Bu kaydi doguran event'in kimligi. Identity'nin kendi eylemlerinde taze bir ULID uretilir.</summary>
    public required string SourceEventId { get; set; }

    public string? ActorId { get; set; }

    public string? ActorRole { get; set; }

    public required string Action { get; set; }

    public required string SourceService { get; set; }

    public string? ResourceType { get; set; }

    public string? ResourceId { get; set; }

    public string? IpAddress { get; set; }

    public required AuditResult Result { get; set; }

    public required string CorrelationId { get; set; }

    /// <summary>Serbest bicimli ek detay. PostgreSQL'de jsonb.</summary>
    public string? DetailsJson { get; set; }

    public required DateTimeOffset OccurredAt { get; set; }

    public required DateTimeOffset PersistedAt { get; set; }
}
