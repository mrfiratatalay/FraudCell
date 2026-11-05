namespace FraudCell.Identity.Service.Domain;

/// <summary>
/// <c>identity.refresh_sessions</c>. Refresh token rotation,
/// session yonetimi ve token reuse tespiti. Her rotation'da yeni bir satir
/// olusur ve eskisi <see cref="RevokedAt"/>/<see cref="ReplacedBySessionId"/>
/// ile isaretlenir. Revoke edilmis bir token TEKRAR kullanilirsa
/// (<see cref="ReuseDetectedAt"/> doldurulur), ayni <see cref="FamilyId"/>'ye
/// sahip TUM satirlar revoke edilir.
/// </summary>
public sealed class RefreshSession
{
    public required string Id { get; set; }

    public required string UserId { get; set; }

    public required string FamilyId { get; set; }

    /// <summary>SHA-256(raw token). Ham token veritabaninda asla saklanmaz.</summary>
    public required string TokenHash { get; set; }

    public string? ParentSessionId { get; set; }

    public string? ReplacedBySessionId { get; set; }

    public required DateTimeOffset CreatedAt { get; set; }

    public required DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? LastUsedAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public string? RevocationReason { get; set; }

    public DateTimeOffset? ReuseDetectedAt { get; set; }

    public string? CreatedIp { get; set; }

    public string? LastUsedIp { get; set; }

    public string? UserAgent { get; set; }

    public long Version { get; set; }

    public bool IsActive(DateTimeOffset now) => RevokedAt is null && ExpiresAt > now;
}

public static class RevocationReasons
{
    public const string Rotated = "ROTATED";
    public const string Logout = "LOGOUT";
    public const string ReuseDetected = "REUSE_DETECTED";
    public const string AdminRevoked = "ADMIN_REVOKED";
    public const string UserRevoked = "USER_REVOKED";
}
