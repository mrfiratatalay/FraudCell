namespace FraudCell.Identity.Service.Domain;

public enum LoginType
{
    CustomerOtp,
    StaffPassword,
}

public enum LoginAttemptResult
{
    Success,
    Failure,
    Locked,
    RateLimited,
}

/// <summary>
/// <c>identity.login_attempts</c>. Guvenlik incelemesi, audit
/// uretimi, brute-force analizi ve login metrikleri icin kullanilir.
/// <see cref="LoginIdentifierHash"/>, bilinmeyen kullanici denemelerinde
/// e-posta/GSM'nin plaintext loglanmasini onler.
/// </summary>
public sealed class LoginAttempt
{
    public required string Id { get; set; }

    public string? UserId { get; set; }

    public required string LoginIdentifierHash { get; set; }

    public required LoginType LoginType { get; set; }

    public required LoginAttemptResult Result { get; set; }

    public string? FailureReason { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public required DateTimeOffset OccurredAt { get; set; }

    public required string CorrelationId { get; set; }
}
